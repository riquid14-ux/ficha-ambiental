import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEFAULT_PROJECT_MAP, MAP_READ_ROLES } from "../shared/project-map";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, partnerAllowedProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql, eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { storageGet, storagePut } from "./storage";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { sendFichaSubmittedNotification, sendFichaReviewedNotification, sendInvitationEmail } from "./email";
import { sanitizeFile } from "./file-sanitizer";
import { getPhotogrammetryWorkerStatus, validatePhotogrammetryBatch } from "./photogrammetry";

// Security: Allowed MIME types for file uploads
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);
const MAX_FILE_SIZE_B64 = 15 * 1024 * 1024; // ~10MB file = ~13.3MB base64

// Security: Log file upload for audit trail
async function logFileUpload(userId: number, filename: string, mimeType: string, safe: boolean, threats: string[], context: string) {
  try {
    const database = await db.getDb();
    if (!database) return;
    await database.insert(schema.auditLog).values({
      userId,
      action: safe ? "file_upload" : "file_upload_blocked",
      entity: "file",
      newValue: JSON.stringify({
        filename,
        mimeType,
        context,
        safe,
        threats: threats.length > 0 ? threats : undefined,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[Audit] Failed to log file upload:", e);
  }
}

// Helper: check if user has elevated permissions (admin or dono_obra)
function isAdminOrDono(role: string) {
  return role === "admin" || role === "dono_obra";
}

async function assertProjectAccess(user: any, projectId: number) {
  const project = await db.getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projecto não encontrado." });
  if (isAdminOrDono(user.role)) return project;

  const userProjects = await db.getUserProjects(user.id);
  if (user.role === "pm") {
    if (!userProjects.some((item: any) => item.projectId === projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "Este projecto não está atribuído ao PM." });
    return project;
  }
  const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
  const allowedProjectIds = new Set([
    ...userProjects.map((item: any) => item.projectId),
    ...companyProjects.map((item: any) => item.projectId),
  ]);
  if (!allowedProjectIds.has(projectId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao projecto seleccionado." });
  }
  return project;
}

async function getAccessibleProjectIds(user: any) {
  if (isAdminOrDono(user.role)) {
    return (await db.getAllProjects()).map(project => project.id);
  }
  const userProjects = await db.getUserProjects(user.id);
  if (user.role === "pm") return userProjects.map((item: any) => item.projectId);
  const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
  return Array.from(new Set([
    ...userProjects.map((item: any) => item.projectId),
    ...companyProjects.map((item: any) => item.projectId),
  ]));
}

type PartnerModule = "kpi" | "waste";

async function getActivePartnerProfile(user: any, module?: PartnerModule) {
  if (user.role !== "ee_partner") return null;
  const profile = await db.getPartnerAccessProfile(user.id);
  if (!profile?.active) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O acesso deste parceiro não está activo." });
  }
  if (module === "kpi" && !profile.allowKpi) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao módulo KPI." });
  }
  if (module === "waste" && !profile.allowWaste) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao módulo Resíduos." });
  }
  return profile;
}

async function assertPartnerProjectModuleAccess(user: any, projectId: number, module: PartnerModule) {
  if (user.role !== "ee_partner") {
    await assertProjectAccess(user, projectId);
    return null;
  }
  const profile = await getActivePartnerProfile(user, module);
  const allowedProjectIds = await db.getPartnerAllowedProjectIds(user.id, profile!.parentCompanyId);
  if (!allowedProjectIds.includes(projectId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este projecto não pertence ao âmbito autorizado da EE principal." });
  }
  return profile;
}

function assertMapReadRole(role: string) {
  if (!(MAP_READ_ROLES as readonly string[]).includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O Mapa está disponível apenas para Administrador, Dono de Obra e Gestor de Projecto." });
  }
}

function assertMapWriteRole(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para alterar levantamentos do Mapa." });
  }
}

function effectiveProjectMapSetting(projectId: number, stored?: Awaited<ReturnType<typeof db.getProjectMapSetting>>) {
  return {
    id: stored?.id ?? 0,
    projectId,
    baseMapFileKey: DEFAULT_PROJECT_MAP.fileKey,
    baseMapUrl: DEFAULT_PROJECT_MAP.url,
    boundsJson: stored?.boundsJson ?? JSON.stringify(DEFAULT_PROJECT_MAP.bounds),
    sourceName: DEFAULT_PROJECT_MAP.sourceName,
    sourceUrl: DEFAULT_PROJECT_MAP.sourceUrl,
    attribution: DEFAULT_PROJECT_MAP.attribution,
    license: DEFAULT_PROJECT_MAP.license,
    updatedBy: stored?.updatedBy ?? null,
    createdAt: stored?.createdAt ?? null,
    updatedAt: stored?.updatedAt ?? null,
  };
}

function canUpdatePlanProgress(user: any, assignment: any) {
  return isAdminOrDono(user.role) || user.role === "raa" || assignment.ownerId === user.id;
}

function getUserDisplayName(user: any) {
  return user.fullName || user.name || user.email || `Utilizador ${user.id}`;
}

// Helper: check if user can submit forms (ee or rap)
function canSubmitForms(role: string) {
  return role === "ee" || role === "rap" || role === "admin" || role === "dono_obra";
}

// Helper: check if user can review forms (raa, admin, dono_obra)
function canReview(role: string) {
  return role === "raa" || role === "admin" || role === "dono_obra";
}

type ImportDestination = "review" | "historical";

const importedResponseSchema = z.object({
  measureId: z.number().int().positive(),
  status: z.enum(["I", "C", "NC", "NA"]),
  observations: z.string().max(10000).nullable().optional(),
});

const importedImageSchema = z.object({
  fileKey: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  page: z.number().int().min(0).optional(),
});

function getImportedDocumentMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas ficheiros PDF ou Word (.docx) são permitidos." });
}

function getIsoWeekDateRange(weekNumber: number, year: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const format = (date: Date) => `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
  return { start: format(monday), end: format(sunday) };
}

async function assertImportPermission(user: any, projectId: number, companyId: number, destination: ImportDestination) {
  if (destination === "review" && !canSubmitForms(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para submeter fichas para revisão." });
  }
  if (destination === "historical" && user.role !== "admin" && user.role !== "raa") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores e RAA podem registar fichas como histórico aprovado." });
  }

  const project = await db.getProjectById(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projecto não encontrado." });

  if (user.role !== "admin" && user.role !== "dono_obra") {
    if (project.code === "SIN01") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso a este projecto." });
    }
    const userProjects = await db.getUserProjects(user.id);
    const companyProjects = user.companyId ? await db.getProjectsForCompany(user.companyId) : [];
    const allowedProjectIds = new Set([
      ...userProjects.map((item: any) => item.projectId),
      ...companyProjects.map((item: any) => item.projectId),
    ]);
    if (!allowedProjectIds.has(projectId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao projecto seleccionado." });
    }
  }

  if ((user.role === "ee" || user.role === "rap") && user.companyId !== companyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Só pode importar fichas da sua empresa." });
  }

  const projectCompanies = await db.getProjectCompanies(projectId);
  if (!projectCompanies.some((item: any) => item.companyId === companyId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa seleccionada não está associada a este projecto." });
  }

  return project;
}

export const appRouter = router({
  system: systemRouter,

  phaseEvidence: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getPhaseEvidence(input.projectId, input.measureId);
      }),

    addComment: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number(), content: z.string().min(1), referenceYear: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
        }
        const result = await db.addPhaseEvidence({
          measureId: input.measureId,
          projectId: input.projectId,
          type: "comment",
          content: input.content,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || "Utilizador",
          referenceYear: input.referenceYear ?? null,
        });
        return result;
      }),

    uploadFile: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
        isPhoto: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão" });
        }
        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize file content
        const sanitizeResult = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitizeResult.safe, sanitizeResult.threats, "phase-evidence");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const ext = input.filename.split(".").pop() || "bin";
        const timestamp = Date.now();
        const fileKey = `phase-evidence/${input.projectId}/${input.measureId}/${timestamp}.${ext}`;
        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);

        const result = await db.addPhaseEvidence({
          measureId: input.measureId,
          projectId: input.projectId,
          type: input.isPhoto ? "photo" : "file",
          content: url,
          fileKey: key,
          filename: input.filename,
          mimeType: input.mimeType,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email || "Utilizador",
        });
        return { id: result.id, url, filename: input.filename };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deletePhaseEvidence(input.id);
        return { success: true };
      }),
  }),

  appSettings: router({
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) return null;
        const rows = await database.execute(sql`SELECT value FROM app_settings WHERE \`key\` = ${input.key}`);
        return (rows as any)?.[0]?.[0]?.value || null;
      }),
    getAll: protectedProcedure
      .query(async () => {
        const database = await db.getDb();
        if (!database) return {};
        const rows = await database.execute(sql`SELECT \`key\`, value FROM app_settings`);
        const result: Record<string, string> = {};
        for (const r of (rows as any)?.[0] || []) {
          result[r.key] = r.value;
        }
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.execute(sql`INSERT INTO app_settings (\`key\`, value) VALUES (${input.key}, ${input.value}) ON DUPLICATE KEY UPDATE value = ${input.value}`);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        // Delete the key and its associated _position and _page keys
        await database.execute(sql`DELETE FROM app_settings WHERE \`key\` IN (${input.key}, ${input.key + "_position"}, ${input.key + "_page"})`);
        return { success: true };
      }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => {
      const u = opts.ctx.user;
      if (!u) return null;
      const { passwordHash, totpSecret, ...safe } = u as any;
      return { ...safe, passwordHash: !!passwordHash, totpEnabled: !!(u as any).totpEnabled };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // ─── Login with email + password ────────────────────────────────────────
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        const user = existingUsers.find((u) => u.email?.toLowerCase().trim() === email);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou palavra-passe incorretos." });
        }
        if ((user as any).accountStatus === "pending") {
          throw new TRPCError({ code: "FORBIDDEN", message: "A sua conta está pendente de aprovação. Contacte apoioamb@startcampus.pt" });
        }
        if ((user as any).accountStatus === "rejected") {
          throw new TRPCError({ code: "FORBIDDEN", message: "O seu pedido de acesso foi rejeitado. Contacte apoioamb@startcampus.pt" });
        }
        // Verify password
        const passwordHash = (user as any).passwordHash;
        if (!passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Conta sem palavra-passe definida. Contacte o administrador." });
        }
        const passwordValid = await bcrypt.compare(input.password, passwordHash);
        if (!passwordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou palavra-passe incorretos." });
        }
        // Check if 2FA is enabled
        if ((user as any).totpEnabled) {
          return { success: true, requires2FA: true, userId: user.id, mustChangePassword: !!(user as any).mustChangePassword };
        }
        // Create session
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || email });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, requires2FA: false, userId: user.id, mustChangePassword: !!(user as any).mustChangePassword };
      }),

    // ─── Forgot Password ─────────────────────────────────────────────────
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await database.select().from(schema.users).where(eq(schema.users.email, input.email.toLowerCase().trim())).limit(1);
        if (!user) return { success: true, message: "Se o email existir no sistema, o administrador será notificado. Contacte apoioamb@startcampus.pt" };
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = Date.now() + 3600000;
        await database.update(schema.users).set({ passwordResetToken: token, passwordResetExpiry: expiry }).where(eq(schema.users.id, user.id));
        // Password reset token generated
        return { success: true, message: "Pedido de recuperação registado. Contacte apoioamb@startcampus.pt para receber as instruções de reset." };
      }),
    // ─── Reset Password with Token ──────────────────────────────────────
    resetPasswordWithToken: publicProcedure
      .input(z.object({ email: z.string().email(), token: z.string(), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await database.select().from(schema.users).where(eq(schema.users.email, input.email.toLowerCase().trim())).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador não encontrado" });
        const u = user as any;
        if (!u.passwordResetToken || u.passwordResetToken !== input.token) throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido" });
        if (u.passwordResetExpiry && Date.now() > u.passwordResetExpiry) throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado" });
        const hash = await bcrypt.hash(input.newPassword, 10);
        await database.update(schema.users).set({ passwordHash: hash, mustChangePassword: 0, passwordResetToken: null, passwordResetExpiry: null }).where(eq(schema.users.id, user.id));
        return { success: true };
      }),
    // ─── Verify 2FA code ────────────────────────────────────────────────────
    verify2FA: publicProcedure
      .input(z.object({ userId: z.number(), code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(input.userId);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const totpSecret = (user as any).totpSecret;
        if (!totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "2FA não configurado." });
        const totp = new TOTP({ secret: Secret.fromBase32(totpSecret), algorithm: "SHA1", digits: 6, period: 30 });
        const valid = totp.validate({ token: input.code, window: 1 }) !== null;
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido. Tente novamente." });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.email || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, mustChangePassword: !!(user as any).mustChangePassword };
      }),

    // ─── Register (creates pending account) ─────────────────────────────────
    register: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(1), companyName: z.string().optional() }))
      .mutation(async ({ input }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        if (existingUsers.find((u) => u.email?.toLowerCase().trim() === email)) {
          return { success: true, message: "Conta criada com sucesso. Aguarde aprovação do administrador." };
        }
        const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
        const passwordHash = await bcrypt.hash(input.password, 10);
        const displayName = input.companyName ? `${input.name} (${input.companyName})` : input.name;
        await db.upsertUser({ openId, name: displayName, email, loginMethod: "email", role: "user" });
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${passwordHash}, mustChangePassword = 0, accountStatus = 'pending' WHERE openId = ${openId}`);
        }
        return { success: true, message: "Conta criada com sucesso. Aguarde aprovação do administrador." };
      }),

    // ─── Change password ────────────────────────────────────────────────────
    changePassword: partnerAllowedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const passwordHash = (user as any).passwordHash;
        if (passwordHash) {
          const valid = await bcrypt.compare(input.currentPassword, passwordHash);
          if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Palavra-passe actual incorreta." });
        }
        const newHash = await bcrypt.hash(input.newPassword, 10);
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${newHash}, mustChangePassword = 0 WHERE id = ${ctx.user.id}`);
        }
        return { success: true };
      }),

    // ─── Setup 2FA ──────────────────────────────────────────────────────────
    setup2FA: partnerAllowedProcedure.mutation(async ({ ctx }) => {
      const secret = new Secret({ size: 20 });
      const totp = new TOTP({ issuer: "Controlo Ambiental", label: ctx.user.email || ctx.user.name || "user", secret, algorithm: "SHA1", digits: 6, period: 30 });
      const uri = totp.toString();
      const qrCode = await QRCode.toDataURL(uri);
      // Save secret temporarily (not enabled yet)
      const database = await db.getDb();
      if (database) {
        await database.execute(sql`UPDATE users SET totpSecret = ${secret.base32} WHERE id = ${ctx.user.id}`);
      }
      return { qrCode, secret: secret.base32, uri };
    }),

    // ─── Confirm 2FA setup ──────────────────────────────────────────────────
    confirm2FA: partnerAllowedProcedure
      .input(z.object({ code: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND" });
        const totpSecret = (user as any).totpSecret;
        if (!totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure primeiro o 2FA." });
        const totp = new TOTP({ secret: Secret.fromBase32(totpSecret), algorithm: "SHA1", digits: 6, period: 30 });
        const valid = totp.validate({ token: input.code, window: 1 }) !== null;
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET totpEnabled = 1 WHERE id = ${ctx.user.id}`);
        }
        return { success: true };
      }),

    // ─── Disable 2FA ────────────────────────────────────────────────────────
    disable2FA: partnerAllowedProcedure.mutation(async ({ ctx }) => {
      const database = await db.getDb();
      if (database) {
        await database.execute(sql`UPDATE users SET totpEnabled = 0, totpSecret = NULL WHERE id = ${ctx.user.id}`);
      }
      return { success: true };
    }),

    // ─── Admin: reset user password ─────────────────────────────────────────
    adminResetPassword: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const tempPassword = Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(tempPassword, 10);
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${hash}, mustChangePassword = 1 WHERE id = ${input.userId}`);
        }
        return { success: true, tempPassword };
      }),
    // ─── Admin: delete non-admin user ───────────────────────────────────────
    deleteUser: protectedProcedure
      .input(z.object({ userId: z.number(), confirmName: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const allUsers = await db.getAllUsers();
        const targetUser = allUsers.find(u => u.id === input.userId);
        if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Utilizador nao encontrado" });
        if (targetUser.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Nao e possivel eliminar um administrador" });
        if ((targetUser.name || "").toLowerCase().trim() !== input.confirmName.toLowerCase().trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nome nao corresponde" });
        }
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`DELETE FROM users WHERE id = ${input.userId}`);
        }
        return { success: true };
      }),

    // ─── Admin: approve/reject pending accounts ─────────────────────────────
    approveAccount: protectedProcedure
      .input(z.object({ userId: z.number(), approve: z.boolean(), role: z.string().optional(), companyId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const status = input.approve ? "active" : "rejected";
        const database = await db.getDb();
        if (database) {
          const role = input.role || "user";
          const companyId = input.companyId || null;
          await database.execute(sql`UPDATE users SET accountStatus = ${status}, role = ${role}, companyId = ${companyId} WHERE id = ${input.userId}`);
        }
        return { success: true };
      }),

    // ─── List pending accounts (for admin) ──────────────────────────────────
    pendingAccounts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") return [];
      const database = await db.getDb();
      if (!database) return [];
      const rows = await database.execute(sql`SELECT id, name, email, createdAt FROM users WHERE accountStatus = 'pending'`);
      return (rows as any)?.[0] || [];
    }),

  }),

  // ─── Companies ───────────────────────────────────────────────────────────
  companies: router({
    list: protectedProcedure.query(async () => {
      const [companies, partnerProfiles] = await Promise.all([db.getAllCompanies(), db.getPartnerCompanyProfiles()]);
      return companies.map(company => {
        const profile = partnerProfiles.find(item => item.companyId === company.id);
        const parent = profile ? companies.find(item => item.id === profile.parentCompanyId) : null;
        return { ...company, parentCompanyId: profile?.parentCompanyId ?? null, parentCompanyName: parent?.shortName ?? parent?.name ?? null, allowKpi: !!profile?.allowKpi, allowWaste: !!profile?.allowWaste };
      });
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompanyById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        name: z.string().trim().min(2), shortName: z.string().trim().min(2),
        companyType: z.enum(["ee", "ee_partner", "rap", "dono_obra", "raa", "observador"]).default("ee"),
        projectIds: z.array(z.number().int().positive()).min(1, "Seleccione pelo menos um projecto."),
        parentCompanyId: z.number().int().positive().optional(), allowKpi: z.boolean().default(false), allowWaste: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.companyType === "ee_partner") {
          if (!input.parentCompanyId || (!input.allowKpi && !input.allowWaste)) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma EEP exige EE principal e acesso a KPI e/ou Resíduos." });
          const parent = await db.getCompanyById(input.parentCompanyId);
          const allowed = await db.getProjectsForCompany(input.parentCompanyId);
          const allowedIds = new Set(allowed.map(item => item.projectId));
          if (parent?.companyType !== "ee" || input.projectIds.some(id => !allowedIds.has(id))) throw new TRPCError({ code: "FORBIDDEN", message: "A EEP só pode receber projectos da EE principal seleccionada." });
        }
        const created = await db.createCompany({ name: input.name, shortName: input.shortName, companyType: input.companyType });
        await db.setCompanyProjects(created.id, input.projectIds);
        if (input.companyType === "ee_partner") await db.upsertPartnerCompanyProfile({ companyId: created.id, parentCompanyId: input.parentCompanyId!, allowKpi: input.allowKpi, allowWaste: input.allowWaste, active: true, configuredBy: ctx.user.id });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "company_created", "companies", created.id, null, JSON.stringify(input));
        return created;
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), shortName: z.string().optional(), active: z.number().optional(), companyType: z.enum(["ee", "ee_partner", "rap", "dono_obra", "raa", "observador"]).optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCompany(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const database = await db.getDb();
        if (database) {
          const counts = await database.execute(sql`SELECT
            (SELECT COUNT(*) FROM weekly_submissions WHERE companyId = ${input.id} AND status <> 'deleted') AS weeklyCount,
            (SELECT COUNT(*) FROM waste_egars WHERE companyId = ${input.id}) AS wasteCount,
            (SELECT COUNT(*) FROM kpi_submissions WHERE companyId = ${input.id}) AS kpiCount,
            (SELECT COUNT(*) FROM partner_company_profiles WHERE parentCompanyId = ${input.id} AND active = 1) AS childCount`);
          const row = ((counts as any)?.[0]?.[0] ?? {}) as Record<string, number>;
          if (Number(row.weeklyCount) + Number(row.wasteCount) + Number(row.kpiCount) > 0) throw new TRPCError({ code: "CONFLICT", message: "A empresa tem dados históricos. Desactive-a em vez de a eliminar." });
          if (Number(row.childCount) > 0) throw new TRPCError({ code: "CONFLICT", message: "A empresa tem EEP associadas. Reatribua ou desactive essas EEP antes de eliminar." });
          await database.transaction(async tx => {
            await tx.execute(sql`DELETE FROM project_users WHERE userId IN (SELECT id FROM users WHERE companyId = ${input.id})`);
            await tx.execute(sql`DELETE FROM partner_access_profiles WHERE userId IN (SELECT id FROM users WHERE companyId = ${input.id})`);
            await tx.execute(sql`UPDATE users SET companyId = NULL, role = 'user' WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM invitations WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM partner_company_profiles WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM project_companies WHERE companyId = ${input.id}`);
            await tx.execute(sql`DELETE FROM companies WHERE id = ${input.id}`);
          });
          await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "company_deleted", "companies", input.id, null, null);
        }
        return { success: true };
      }),
  }),

  // ─── Users Management (Admin / Dono de Obra) ──────────────────────────────
  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    assignCompany: adminProcedure
      .input(z.object({ userId: z.number(), companyId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        await db.updateUserCompany(input.userId, input.companyId);
        // Auto-assign role based on company type
        if (input.companyId) {
          // Never demote an admin when assigning company
          const targetUser = await db.getUserById(input.userId);
          if (targetUser?.role === "admin") {
            return { success: true };
          }
          const company = await db.getCompanyById(input.companyId);
          if (company) {
            const roleMap: Record<string, string> = {
              ee: "ee",
              ee_partner: "ee_partner",
              rap: "rap",
              dono_obra: "dono_obra",
              raa: "raa",
              observador: "observador",
            };
            const newRole = (roleMap[company.companyType] || "user") as "user" | "admin" | "ee" | "ee_partner" | "raa" | "rap" | "dono_obra" | "observador";
            await db.updateUserRole(input.userId, newRole);
          }
        }
        return { success: true };
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]) }))
      .mutation(async ({ input, ctx }) => {
        // Only admin can promote to admin or dono_obra
        if ((input.role === "admin" || input.role === "dono_obra") && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem atribuir o papel de Admin ou Dono de Obra." });
        }
        // Prevent demoting an admin unless the requester is also an admin
        const targetUser = await db.getUserById(input.userId);
        if (targetUser?.role === "admin" && input.role !== "admin") {
          // Only admins can manage other admin roles
          throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível remover o papel de Admin a outro administrador." });
        }
        // Prevent dono_obra from changing another dono_obra
        if (targetUser?.role === "dono_obra" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem alterar o papel de um Dono de Obra." });
        }
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
  }),

  // ─── EE Partner configuration ─────────────────────────────────────────────
  partners: router({
    myAccess: partnerAllowedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "ee_partner") return null;
      const profile = await getActivePartnerProfile(ctx.user);
      const [parentCompany, partnerCompany] = await Promise.all([
        db.getCompanyById(profile!.parentCompanyId),
        ctx.user.companyId ? db.getCompanyById(ctx.user.companyId) : Promise.resolve(undefined),
      ]);
      return {
        parentCompanyId: profile!.parentCompanyId,
        parentCompanyName: parentCompany?.shortName ?? parentCompany?.name ?? null,
        companyId: ctx.user.companyId,
        companyName: partnerCompany?.shortName ?? partnerCompany?.name ?? null,
        allowKpi: !!profile!.allowKpi,
        allowWaste: !!profile!.allowWaste,
        active: !!profile!.active,
      };
    }),
    list: adminProcedure.query(async () => {
      const [allUsers, allCompanies, profiles, assignments, allProjects] = await Promise.all([
        db.getAllUsers(),
        db.getAllCompanies(),
        db.getPartnerAccessProfiles(),
        db.getAllUserProjectAssignments(),
        db.getAllProjects(),
      ]);
      return allUsers.filter(user => user.role === "ee_partner").map(user => {
        const profile = profiles.find(item => item.userId === user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          companyName: allCompanies.find(company => company.id === user.companyId)?.shortName ?? null,
          parentCompanyId: profile?.parentCompanyId ?? null,
          parentCompanyName: allCompanies.find(company => company.id === profile?.parentCompanyId)?.shortName ?? null,
          allowKpi: !!profile?.allowKpi,
          allowWaste: !!profile?.allowWaste,
          active: profile?.active ?? false,
          projectIds: assignments.filter(item => item.userId === user.id).map(item => item.projectId),
          projects: assignments.filter(item => item.userId === user.id).map(item => allProjects.find(project => project.id === item.projectId)).filter(Boolean),
        };
      });
    }),
    configure: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        parentCompanyId: z.number().int().positive(),
        allowKpi: z.boolean(),
        allowWaste: z.boolean(),
        active: z.boolean().default(true),
        projectIds: z.array(z.number().int().positive()),
      }))
      .mutation(async ({ ctx, input }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.role !== "ee_partner") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione um utilizador com o papel EEP — Entidade Executante Parceira." });
        }
        if (!targetUser.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O parceiro deve estar associado à sua empresa subcontratada." });
        }
        const [partnerCompany, parentCompany, parentAssignments] = await Promise.all([
          db.getCompanyById(targetUser.companyId),
          db.getCompanyById(input.parentCompanyId),
          db.getProjectsForCompany(input.parentCompanyId),
        ]);
        if (partnerCompany?.companyType !== "ee_partner") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa do utilizador deve ser do tipo EEP — Entidade Executante Parceira." });
        }
        if (parentCompany?.companyType !== "ee") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa principal deve ser uma EE." });
        }
        const parentProjectIds = new Set(parentAssignments.map(item => item.projectId));
        if (input.projectIds.some(projectId => !parentProjectIds.has(projectId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Um parceiro não pode receber projectos fora do âmbito da EE principal." });
        }
        await db.upsertPartnerAccessProfile({
          userId: input.userId,
          parentCompanyId: input.parentCompanyId,
          allowKpi: input.allowKpi,
          allowWaste: input.allowWaste,
          active: input.active,
          configuredBy: ctx.user.id,
        });
        await db.setUserProjects(input.userId, input.projectIds);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "partner_access_configured", "users", input.userId, null, JSON.stringify(input));
        return { success: true };
      }),
  }),

  eepRequests: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas uma EE pode submeter pedidos EEP." });
      return db.getEepRequests({ parentCompanyId: ctx.user.companyId });
    }),
    create: protectedProcedure.input(z.object({
      companyName: z.string().trim().min(2).max(255), shortName: z.string().trim().min(2).max(50),
      allowKpi: z.boolean(), allowWaste: z.boolean(), projectIds: z.array(z.number().int().positive()).min(1),
      users: z.array(z.object({ fullName: z.string().trim().min(2).max(255), email: z.string().email() })).min(1).max(20),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas uma EE pode submeter pedidos EEP." });
      if (!input.allowKpi && !input.allowWaste) throw new TRPCError({ code: "BAD_REQUEST", message: "Seleccione acesso a KPI e/ou Resíduos." });
      const company = await db.getCompanyById(ctx.user.companyId);
      const allowed = await db.getProjectsForCompany(ctx.user.companyId);
      const allowedIds = new Set(allowed.map(item => item.projectId));
      if (company?.companyType !== "ee" || input.projectIds.some(id => !allowedIds.has(id))) throw new TRPCError({ code: "FORBIDDEN", message: "Só pode pedir EEP para projectos da sua EE." });
      const emails = input.users.map(user => user.email.toLowerCase().trim());
      if (new Set(emails).size !== emails.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não repita o mesmo email no pedido." });
      const allUsers = await db.getAllUsers(); const allInvites = await db.getAllInvitations(); const allCompanies = await db.getAllCompanies();
      if (allCompanies.some(item => item.shortName.toLowerCase() === input.shortName.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma empresa com esta sigla." });
      if (emails.some(email => allUsers.some(user => user.email?.toLowerCase() === email) || allInvites.some(invite => invite.email.toLowerCase() === email && invite.status === "pending"))) throw new TRPCError({ code: "CONFLICT", message: "Um dos emails já tem conta ou convite pendente." });
      const requestId = await db.createEepRequest({ requestedByUserId: ctx.user.id, parentCompanyId: ctx.user.companyId, companyName: input.companyName, shortName: input.shortName, allowKpi: input.allowKpi, allowWaste: input.allowWaste, projectIdsJson: JSON.stringify(input.projectIds) }, input.users.map((user, index) => ({ fullName: user.fullName, email: emails[index] })));
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_created", "eep_requests", requestId, null, JSON.stringify({ ...input, users: input.users.map(user => ({ ...user, email: user.email.toLowerCase().trim() })) }));
      return { success: true, requestId };
    }),
    list: adminProcedure.query(async () => db.getEepRequests()),
    approve: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getEepRequestById(input.id); if (!request || request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Pedido inexistente ou já decidido." });
      const users = await db.getEepRequestUsers(input.id); const allInvites = await db.getAllInvitations(); const allUsers = await db.getAllUsers(); const allCompanies = await db.getAllCompanies();
      if (allCompanies.some(item => item.shortName.toLowerCase() === request.shortName.toLowerCase())) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma empresa com esta sigla." });
      if (users.some(item => allUsers.some(user => user.email?.toLowerCase() === item.email) || allInvites.some(invite => invite.email.toLowerCase() === item.email && invite.status === "pending"))) throw new TRPCError({ code: "CONFLICT", message: "Um dos emails já tem conta ou convite pendente." });
      const result = await db.approveEepRequest(input.id, ctx.user.id, input.notes ?? null); if (!result) throw new TRPCError({ code: "CONFLICT", message: "O pedido já foi decidido." });
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_approved", "eep_requests", input.id, null, JSON.stringify({ companyId: result.companyId }));
      return { success: true, companyId: result.companyId };
    }),
    reject: adminProcedure.input(z.object({ id: z.number().int().positive(), notes: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      if (!await db.rejectEepRequest(input.id, ctx.user.id, input.notes)) throw new TRPCError({ code: "CONFLICT", message: "O pedido já foi decidido." });
      await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "eep_request_rejected", "eep_requests", input.id, null, input.notes);
      return { success: true };
    }),
  }),

  // ─── Invitations ────────────────────────────────────────────────────────────
  invitations: router({
    list: adminProcedure.query(async () => {
      const allInvitations = await db.getAllInvitations();
      const allCompanies = await db.getAllCompanies();
      return allInvitations.map((inv) => ({
        ...inv,
        companyName: allCompanies.find((c) => c.id === inv.companyId)?.shortName || "—",
      }));
    }),
    create: adminProcedure
      .input(z.object({
        email: z.string().email(),
        companyId: z.number(),
        role: z.enum(["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if there's already a pending invitation for this email
        const normalizedEmail = input.email.toLowerCase().trim();
        const existing = await db.getPendingInvitationByEmail(normalizedEmail);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um convite pendente para este email." });
        }
        await db.createInvitation({
          email: normalizedEmail,
          companyId: input.companyId,
          role: input.role,
          invitedBy: ctx.user.id,
        });
        // Send invitation email (async, don't block)
        try {
          const company = await db.getCompanyById(input.companyId);
          const roleLabels: Record<string, string> = {
            user: "Utilizador", admin: "Administrador", ee: "Entidade Executante", ee_partner: "EEP — Entidade Executante Parceira",
            raa: "RAA", rap: "RAP", dono_obra: "Dono de Obra", observador: "Observador",
          };
          sendInvitationEmail(
            normalizedEmail, null,
            company?.shortName || company?.name || "—",
            roleLabels[input.role] || input.role,
            ctx.user.name || ctx.user.email || "Admin"
          ).catch(() => {});
        } catch {}
        return { success: true, emailSent: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteInvitation(input.id);
        return { success: true };
      }),
  }),

  // ─── Sections & Measures ───────────────────────────────────────────────────
  sections: router({
    list: protectedProcedure.query(async () => {
      return db.getAllSections();
    }),
  }),

  measures: router({
    list: protectedProcedure.query(async () => {
      return db.getAllMeasures();
    }),
    bySection: protectedProcedure
      .input(z.object({ sectionId: z.number() }))
      .query(async ({ input }) => {
        return db.getMeasuresBySection(input.sectionId);
      }),
    create: protectedProcedure
      .input(z.object({
        number: z.string().min(1),
        description: z.string().min(1),
        responsible: z.string().default("DO"),
        sectionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
       if (!isAdminOrDono(ctx.user.role)) {
         throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
       }
       const id = await db.createMeasure(input);
       return { id };
     }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        number: z.string().optional(),
        description: z.string().optional(),
        responsible: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin pode editar medidas" });
        }
        await db.updateMeasure(input.id, { number: input.number, description: input.description, responsible: input.responsible });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin pode eliminar medidas" });
        }
        await db.deleteMeasure(input.id);
        return { success: true };
      }),
  }),

  // ─── Weekly Submissions ────────────────────────────────────────────────────
  submissions: router({
    // Create or get existing submission for a week
    createOrGet: protectedProcedure
      .input(z.object({ weekNumber: z.number(), weekYear: z.number(), weekStartDate: z.string(), weekEndDate: z.string(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!canSubmitForms(user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar fichas." });
        }
        if (!input.projectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um projeto específico para criar uma ficha." });
        }
        if (!user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Utilizador não está associado a nenhuma empresa." });
        }

        // Limit to 5 open drafts
        const drafts = await db.getDraftCountForCompany(user.companyId);
        if (drafts >= 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Limite de 5 fichas em rascunho atingido. Submeta ou elimine fichas existentes." });
        }

        // Check if already exists
        const existing = await db.getSubmissionForWeek(user.companyId, input.weekNumber, input.weekYear, input.projectId);
        if (existing) return existing;

        // Create new
        const { id } = await db.createWeeklySubmission({
          companyId: user.companyId,
          projectId: input.projectId ?? null,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          weekStartDate: input.weekStartDate,
          weekEndDate: input.weekEndDate,
          createdBy: user.id,
        });

        // Pre-fill from previous week
        const latest = await db.getLatestSubmissionForCompany(user.companyId);
        if (latest) {
          const prevResponses = await db.getResponsesBySubmission(latest.id);
          if (prevResponses.length > 0) {
            await db.bulkUpsertResponses(
              id,
              prevResponses.map((r) => ({
                measureId: r.measureId,
                status: r.status,
                observations: r.observations ?? null,
              }))
            );
          }
        }

        return db.getSubmissionById(id);
      }),

    // Get submission by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });

        // RAA can see all, EE/RAP can only see own company
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return sub;
      }),

    // List submissions for current user's company
    mySubmissions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return db.getSubmissionsByCompany(ctx.user.companyId);
    }),

    // Admin/Dono/RAA: list all submissions
    listAll: protectedProcedure
      .input(z.object({ companyId: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (input?.companyId) {
          return db.getSubmissionsByCompany(input.companyId);
        }
        if (input?.year) {
          return db.getAllSubmissionsByYear(input.year);
        }
        return db.getAllSubmissions();
      }),

    // Submit (finalize) - EE/RAP can submit
    submit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // Only the creator or admin can submit
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode submeter esta ficha." });
        }
        // Auto-fill NA for measures not relevant to this company type
        const company = await db.getCompanyById(sub.companyId);
        if (company && !isAdminOrDono(ctx.user.role)) {
          // Determine filter type based on user role or company type
          let filterType: string;
          if (ctx.user.role === "rap") {
            filterType = "RAP";
          } else {
            // Use company type for EE
            filterType = company.companyType.toUpperCase() === "RAP" ? "RAP" : "EE";
          }
          const allMeasures = await db.getAllMeasures();
          const nonRelevant = allMeasures.filter((m) => !m.responsible.toUpperCase().includes(filterType));
          if (nonRelevant.length > 0) {
            await db.bulkUpsertResponses(
              input.id,
              nonRelevant.map((m) => ({ measureId: m.id, status: "NA" as const, observations: null }))
            );
          }
        }
        await db.submitWeeklySubmission(input.id, ctx.user.id);
        // Send email notification to RAA users (async, don't block)
        try {
          const project = sub.projectId ? await db.getProjectById(sub.projectId) : null;
          const companyForNotif = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
          // Use configured notification recipients for this project, fallback to all RAA/admin/DO
          let raaEmails: string[] = [];
          if (sub.projectId) {
            const recipients = await db.getNotificationRecipients(sub.projectId, "submission");
            raaEmails = recipients.filter((r: any) => r.userEmail).map((r: any) => r.userEmail!);
          }
          // Only send if there are configured recipients (no fallback = no spam)
          if (raaEmails.length > 0) {
            sendFichaSubmittedNotification(
              input.id, sub.weekNumber, sub.weekYear,
              companyForNotif?.shortName || "—", project?.code || "—", raaEmails
            ).catch(() => {});
          }
        } catch {}
        return { success: true };
      }),

    // Resubmit after rejection - EE/RAP can resubmit
    resubmit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (sub.status !== "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só fichas rejeitadas podem ser re-submetidas." });
        }
        // Only the creator or admin can resubmit
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode resubmeter esta ficha." });
        }
        await db.resubmitSubmission(input.id, ctx.user.id);
        return { success: true };
      }),

    // Delete submission - only creator or admin can delete, only draft/rejected
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // Non-admin users can only delete draft or rejected fichas
        if (!isAdminOrDono(ctx.user.role) && sub.status !== "draft" && sub.status !== "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas fichas em rascunho ou rejeitadas podem ser eliminadas." });
        }
        // Only creator or admin can delete
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode eliminar esta ficha." });
        }
        // Log the deletion before deleting
        const company = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
        await db.createDeletionLog({
          submissionId: input.id,
          projectId: sub.projectId || null,
          weekNumber: sub.weekNumber,
          weekYear: sub.weekYear,
          companyId: sub.companyId,
          companyName: company?.shortName || null,
          createdBy: sub.createdBy || null,
          deletedBy: ctx.user.id,
          deletedByName: ctx.user.name || null,
          deletedByEmail: ctx.user.email || null,
        });
        await db.softDeleteWeeklySubmission(input.id, ctx.user.id);
        // Send email notification to the submitter
        try {
          if (sub.createdBy) {
            const creator = await db.getUserById(sub.createdBy);
            if (creator?.email) {
              const { sendFichaDeletedNotification } = await import("./email");
              await sendFichaDeletedNotification(
                creator.email,
                company?.shortName || "?",
                sub.weekNumber,
                sub.weekYear,
                ctx.user.name || ctx.user.email || "Admin",
                new Date().toLocaleString("pt-PT")
              );
            }
          }
        } catch (e) { console.error("Email notification failed:", e); }
        return { success: true };
      }),

    // Recover a soft-deleted submission - only creator or admin, within 21 days
    recover: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) {
          // Submission was permanently deleted before soft-delete was implemented
          // Mark the log as irrecoverable
          await db.markDeletionLogRecovered(input.id);
          throw new TRPCError({ code: "NOT_FOUND", message: "Esta ficha foi eliminada permanentemente e não pode ser recuperada." });
        }
        if (sub.status !== "deleted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ficha não está eliminada." });
        }
        // Check 21-day recovery window
        const deletedAt = sub.deletedAt;
        if (!deletedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Data de eliminação não encontrada." });
        }
        const daysSinceDeletion = (Date.now() - deletedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceDeletion > 21) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O prazo de 21 dias para recuperação expirou." });
        }
        // Only creator or admin can recover
        if (!isAdminOrDono(ctx.user.role) && sub.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o criador ou admin pode recuperar esta ficha." });
        }
        await db.recoverWeeklySubmission(input.id);
        // Mark the deletion log as recovered
        await db.markDeletionLogRecovered(input.id);
        return { success: true };
      }),

    // Review (approve/reject) - RAA/Admin/Dono can review
    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        notes: z.string().nullable(),
        measureReviews: z.array(z.object({
          measureId: z.number(),
          verdict: z.enum(["ok", "nok"]),
          comment: z.string().nullable(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!canReview(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para rever fichas." });
        }
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // FLOW-04 FIX: Separation of duties — submitter cannot approve own ficha
        if (sub.createdBy === ctx.user.id || sub.submittedBy === ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Não pode aprovar uma ficha que criou ou submeteu. Separação de funções obrigatória." });
        }
        if (sub.status !== "submitted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só fichas submetidas podem ser revistas." });
        }
        // Save per-measure reviews if provided
        if (input.measureReviews && input.measureReviews.length > 0) {
          await db.bulkUpsertMeasureReviews(input.id, ctx.user.id, input.measureReviews);
        }
        await db.reviewSubmission(input.id, ctx.user.id, input.status, input.notes);
        // Audit log
        db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email || null, `ficha_${input.status}`, "weekly_submissions", input.id, null, JSON.stringify({ weekNumber: sub.weekNumber, weekYear: sub.weekYear, notes: input.notes })).catch(() => {});
        // Send email notification to submitter (async, don't block)
        try {
          if (input.status === "approved" || input.status === "rejected") {
            const projectForNotif = sub.projectId ? await db.getProjectById(sub.projectId) : null;
            const submitterForNotif = sub.submittedBy ? await db.getUserById(sub.submittedBy) : null;
            if (submitterForNotif?.email) {
              sendFichaReviewedNotification(
                input.id, sub.weekNumber, sub.weekYear,
                projectForNotif?.code || "—",
                input.status as "approved" | "rejected",
                input.notes, submitterForNotif.email
              ).catch(() => {});
            }
          }
        } catch {}
        // FLOW-02 FIX: When a ficha is APPROVED, update phase measure statuses
        // Each measure with status "C" (Conforme) or "I" (Implementado) marks that measure as "concluido"
        if (input.status === "approved" && sub.projectId) {
          const responses = await db.getResponsesBySubmission(input.id);
          for (const resp of responses) {
            if (resp.status === "C" || resp.status === "I") {
              await db.upsertPhaseMeasureStatus({
                measureId: resp.measureId,
                projectId: sub.projectId,
                status: "concluido",
                notes: `Aprovado via ficha #${input.id} (S${sub.weekNumber}/${sub.weekYear})`,
                updatedBy: ctx.user.id,
              });
            }
          }

          // ─── ARCHIVE: Send approved ficha to external storage ─────────
          try {
            const { archiveDocument } = await import("./archive-provider");
            const project = await db.getProjectById(sub.projectId);
            const company = sub.companyId ? await db.getCompanyById(sub.companyId) : null;
            const evidence = await db.getImagesBySubmission(input.id);
            const comments = await db.getCommentsBySubmission(input.id);

            await archiveDocument("ficha", project?.code || "UNKNOWN", sub.weekYear || new Date().getFullYear(), {
              submission: { ...sub, status: "approved", reviewedBy: ctx.user.id, reviewedAt: Date.now(), reviewNotes: input.notes },
              responses,
              evidenceUrls: evidence.map((e: any) => e.url),
              reviewComments: comments,
              companyName: company?.name || null,
              projectName: project?.name || null,
            }, {
              weekNumber: sub.weekNumber,
              weekYear: sub.weekYear,
              companyId: sub.companyId,
              companyName: company?.name || null,
              submissionId: input.id,
              status: "approved",
            });
          } catch (archiveErr) {
            // Archive failure is non-fatal — data stays in DB as fallback
            console.warn("Archive to external storage failed (non-fatal):", archiveErr);
          }
        }
        return { success: true };
      }),
    // ─── Import external PDF/Word with preview ───────────────────────────
    analyzeImport: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        companyId: z.number().int().positive(),
        weekNumber: z.number().int().min(1).max(53),
        year: z.number().int().min(2020).max(2100),
        destination: z.enum(["review", "historical"]),
        fileBase64: z.string().min(1).max(MAX_FILE_SIZE_B64),
        filename: z.string().min(1).max(255),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertImportPermission(ctx.user, input.projectId, input.companyId, input.destination);

        const existing = await db.getSubmissionForWeek(input.companyId, input.weekNumber, input.year, input.projectId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma ficha para a Semana ${input.weekNumber}/${input.year} desta empresa neste projecto.`,
          });
        }

        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });

        const mimeType = getImportedDocumentMimeType(input.filename);
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máximo 10 MB)." });
        }

        const sanitizeResult = await sanitizeFile(buffer, mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, mimeType, sanitizeResult.safe, sanitizeResult.threats, "ficha-import-preview");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }

        const { callLLM } = await import("./llm-provider");
        const { extractDocumentText, extractImagesFromPdf, extractImagesFromDocx } = await import("./image-extractor");
        let documentText = "";
        try {
          documentText = await extractDocumentText(buffer, input.filename);
        } catch (error) {
          console.warn("Document text extraction failed:", error);
        }
        if (documentText.trim().length < 20) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível extrair texto suficiente do documento. Confirme se o ficheiro contém texto pesquisável." });
        }

        let extractedImages: Awaited<ReturnType<typeof extractImagesFromPdf>> = [];
        try {
          extractedImages = input.filename.toLowerCase().endsWith(".docx")
            ? await extractImagesFromDocx(buffer)
            : await extractImagesFromPdf(buffer);
        } catch (error) {
          console.warn("Image extraction failed (non-fatal):", error);
        }

        const allMeasures = await database.select().from(schema.measures);
        const measureList = allMeasures
          .map((measure: any) => `ID:${measure.id} | ${measure.number || ""} | ${measure.description}`)
          .join("\n");
        const llmResponse = await callLLM([
          {
            role: "system",
            content: "Analisa fichas portuguesas de controlo ambiental. Devolve exclusivamente JSON válido. Para cada medida identificada, indica measureId, status (I, C, NC ou NA) e observations. Não inventes respostas que não estejam no documento.",
          },
          {
            role: "user",
            content: `MEDIDAS DISPONÍVEIS:\n${measureList}\n\nTEXTO EXTRAÍDO DA FICHA:\n${documentText.slice(0, 90000)}\n\nDevolve {"responses":[{"measureId":1,"status":"C","observations":"texto ou null"}]}.`,
          },
        ], 16384);

        let rawResponses: any[] = [];
        try {
          const content = llmResponse.content || "{}";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          rawResponses = Array.isArray(parsed.responses) ? parsed.responses : [];
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível interpretar a análise do documento. Tente novamente." });
        }

        const measureMap = new Map(allMeasures.map((measure: any) => [measure.id, measure]));
        const uniqueResponses = new Map<number, any>();
        for (const response of rawResponses) {
          const measureId = Number(response.measureId);
          const status = String(response.status || "").toUpperCase();
          if (!measureMap.has(measureId) || !["I", "C", "NC", "NA"].includes(status)) continue;
          const measure: any = measureMap.get(measureId);
          uniqueResponses.set(measureId, {
            measureId,
            measureCode: measure?.number || `M${measureId}`,
            measureDescription: measure?.description || "",
            status,
            observations: typeof response.observations === "string" ? response.observations.slice(0, 10000) : null,
          });
        }
        const responses = Array.from(uniqueResponses.values());
        if (responses.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não foram encontradas respostas associáveis às medidas da plataforma." });
        }

        const previewPrefix = `pdf-imports/previews/${ctx.user.id}/${Date.now()}`;
        const { key: fileKey, url: fileUrl } = await storagePut(`${previewPrefix}/${input.filename}`, buffer, mimeType);
        const imagesToUpload = extractedImages.slice(0, 80);
        const images: Array<{ fileKey: string; url: string; filename: string; mimeType: string; page: number }> = [];
        for (let index = 0; index < imagesToUpload.length; index += 8) {
          const batch = imagesToUpload.slice(index, index + 8);
          const uploaded = await Promise.all(batch.map(async (image, batchIndex) => {
            const key = `${previewPrefix}/evidence/${index + batchIndex}_${image.filename}`;
            const stored = await storagePut(key, image.buffer, image.mimeType);
            return { fileKey: stored.key, url: stored.url, filename: image.filename, mimeType: image.mimeType, page: image.page };
          }));
          images.push(...uploaded);
        }

        const counts = responses.reduce((acc: Record<string, number>, response: any) => {
          acc[response.status] = (acc[response.status] || 0) + 1;
          return acc;
        }, { I: 0, C: 0, NC: 0, NA: 0 });

        return {
          fileKey,
          fileUrl,
          filename: input.filename,
          mimeType,
          responses,
          images,
          counts,
          matchedMeasures: responses.length,
          totalMeasures: allMeasures.length,
          extractedPhotos: images.length,
          provider: llmResponse.provider,
          warnings: extractedImages.length > 80 ? ["Foram extraídas mais de 80 imagens; apenas as primeiras 80 serão associadas."] : [],
        };
      }),

    commitImport: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        companyId: z.number().int().positive(),
        weekNumber: z.number().int().min(1).max(53),
        year: z.number().int().min(2020).max(2100),
        destination: z.enum(["review", "historical"]),
        fileKey: z.string().min(1).max(500),
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(100),
        responses: z.array(importedResponseSchema).min(1).max(500),
        images: z.array(importedImageSchema).max(80),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await assertImportPermission(ctx.user, input.projectId, input.companyId, input.destination);
        const expectedPrefix = `pdf-imports/previews/${ctx.user.id}/`;
        if (!input.fileKey.startsWith(expectedPrefix) || input.images.some(image => !image.fileKey.startsWith(expectedPrefix))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Referência de ficheiro inválida." });
        }
        if (getImportedDocumentMimeType(input.filename) !== input.mimeType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo do ficheiro não corresponde ao nome indicado." });
        }

        const existing = await db.getSubmissionForWeek(input.companyId, input.weekNumber, input.year, input.projectId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma ficha para a Semana ${input.weekNumber}/${input.year} desta empresa neste projecto.`,
          });
        }

        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });
        const allMeasures = await database.select({ id: schema.measures.id }).from(schema.measures);
        const validMeasureIds = new Set(allMeasures.map(item => item.id));
        const validResponses = input.responses.filter(response => validMeasureIds.has(response.measureId));
        if (validResponses.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A pré-visualização não contém medidas válidas." });
        }

        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        const dates = getIsoWeekDateRange(input.weekNumber, input.year);
        const storedFile = await storageGet(input.fileKey);
        const resolvedImages = await Promise.all(input.images.map(async image => ({ ...image, url: (await storageGet(image.fileKey)).url })));

        const submissionId = await database.transaction(async tx => {
          const isHistorical = input.destination === "historical";
          const now = Date.now();
          const [submissionResult] = await tx.insert(schema.weeklySubmissions).values({
            projectId: input.projectId,
            companyId: input.companyId,
            weekNumber: input.weekNumber,
            weekYear: input.year,
            weekStartDate: dates.start,
            weekEndDate: dates.end,
            status: isHistorical ? "approved" : "submitted",
            createdBy: ctx.user.id,
            submittedBy: ctx.user.id,
            submittedAt: now,
            reviewedBy: isHistorical ? ctx.user.id : null,
            reviewedAt: isHistorical ? now : null,
            reviewNotes: isHistorical ? "Ficha histórica aprovada importada de PDF/Word" : "Ficha externa importada e submetida para revisão",
          }).$returningId();

          const responseIds: number[] = [];
          for (const response of validResponses) {
            const [responseResult] = await tx.insert(schema.measureResponses).values({
              submissionId: submissionResult.id,
              measureId: response.measureId,
              status: response.status,
              observations: response.observations || null,
            }).$returningId();
            responseIds.push(responseResult.id);
          }

          if (responseIds.length > 0) {
            for (let index = 0; index < resolvedImages.length; index++) {
              const responseIndex = Math.min(Math.floor((index / Math.max(resolvedImages.length, 1)) * responseIds.length), responseIds.length - 1);
              const image = resolvedImages[index];
              await tx.insert(schema.evidenceImages).values({
                responseId: responseIds[responseIndex],
                fileKey: image.fileKey,
                url: image.url,
                filename: image.filename,
                mimeType: image.mimeType,
              });
            }
          }

          await tx.insert(schema.historicalPdfs).values({
            companyId: input.companyId,
            projectId: input.projectId,
            weekNumber: input.weekNumber,
            weekYear: input.year,
            fileKey: input.fileKey,
            url: storedFile.url,
            filename: input.filename,
            uploadedBy: ctx.user.id,
          });

          await tx.insert(schema.auditLog).values({
            userId: ctx.user.id,
            userName: ctx.user.name || ctx.user.email || "Utilizador",
            action: isHistorical ? "historical_ficha_imported" : "external_ficha_submitted",
            entity: "weekly_submission",
            entityId: submissionResult.id,
            newValue: JSON.stringify({
              projectId: input.projectId,
              companyId: input.companyId,
              weekNumber: input.weekNumber,
              weekYear: input.year,
              source: "pdf_word_import",
              destination: input.destination,
              matchedMeasures: validResponses.length,
              extractedPhotos: resolvedImages.length,
            }),
          });

          return submissionResult.id;
        });

        if (input.destination === "review") {
          try {
            const recipients = await db.getNotificationRecipients(input.projectId, "submission");
            const emails = recipients.filter((recipient: any) => recipient.userEmail).map((recipient: any) => recipient.userEmail as string);
            if (emails.length > 0) {
              sendFichaSubmittedNotification(
                submissionId,
                input.weekNumber,
                input.year,
                company.shortName,
                project.code,
                emails,
              ).catch(() => {});
            }
          } catch (error) {
            console.warn("Imported ficha notification failed (non-fatal):", error);
          }
        } else {
          try {
            const { archiveDocument } = await import("./archive-provider");
            await archiveDocument("ficha", project.code, input.year, {
              submission: {
                id: submissionId,
                projectId: input.projectId,
                companyId: input.companyId,
                weekNumber: input.weekNumber,
                weekYear: input.year,
                status: "approved",
                sourceFileUrl: storedFile.url,
              },
              responses: validResponses,
              evidenceUrls: resolvedImages.map(image => image.url),
            }, {
              submissionId,
              weekNumber: input.weekNumber,
              companyId: input.companyId,
              companyName: company.shortName,
              status: "approved",
              source: "historical_import",
            });
          } catch (error) {
            console.warn("Historical import archive failed (non-fatal):", error);
          }
        }

        return {
          success: true,
          submissionId,
          status: input.destination === "historical" ? "approved" as const : "submitted" as const,
          matchedMeasures: validResponses.length,
          extractedPhotos: resolvedImages.length,
        };
      }),

    // Legacy direct import kept for old clients; restricted to administrators.
    importPdf: adminProcedure
      .input(z.object({
        projectId: z.number(),
        weekNumber: z.number(),
        year: z.number(),
        pdfBase64: z.string(), // base64 encoded PDF data
        pdfFilename: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { callLLM } = await import("./llm-provider");
        const { extractImagesFromPdf, extractImagesFromDocx } = await import("./image-extractor");

        // Upload PDF to storage first
        const buffer = Buffer.from(input.pdfBase64, "base64");
        const mimeType = input.pdfFilename.toLowerCase().endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
        // Security: sanitize imported document
        const sanitizeResult = await sanitizeFile(buffer, mimeType, input.pdfFilename);
        await logFileUpload(ctx.user.id, input.pdfFilename, mimeType, sanitizeResult.safe, sanitizeResult.threats, "pdf-import");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const fileKey = `pdf-imports/${input.projectId}/${Date.now()}_${input.pdfFilename}`;
        const { url: pdfStorageUrl } = await storagePut(fileKey, buffer, mimeType);

        // Extract images from the document in parallel with LLM processing
        let extractedImages: Awaited<ReturnType<typeof extractImagesFromPdf>> = [];
        try {
          if (input.pdfFilename.toLowerCase().endsWith(".docx")) {
            extractedImages = await extractImagesFromDocx(buffer);
          } else {
            extractedImages = await extractImagesFromPdf(buffer);
          }
        } catch (e) {
          console.warn("Image extraction failed (non-fatal):", e);
        }

        // Get all measures for this project
        const allMeasures = await database.select().from(schema.measures);
        const measureList = allMeasures.map((m: any) => `ID:${m.id} - ${m.code || ''} ${m.description}`).join('\n');
        
        // Use LLM to extract responses from the PDF
        const llmResponse = await callLLM([
          { role: "system", content: "You are an environmental compliance document parser. Extract measure responses from a Portuguese environmental control sheet (Ficha de Controlo Ambiental). For each measure found in the PDF, return the measure ID, status (I=Implementado, C=Conforme, NC=Não Conforme, NA=Não Aplicável), and any observations text. Return JSON only." },
          { role: "user", content: `Here are the measures in our system:\n${measureList}\n\nI have uploaded a PDF environmental control sheet. The PDF content has been uploaded to: ${pdfStorageUrl}\nMatch each response to the correct measure ID. Return a JSON object with a "responses" array of objects with: measureId (number), status (string: I/C/NC/NA), observations (string or null).` }
        ], 16384);

        let extractedResponses: any[] = [];
        try {
          const content = llmResponse.content || "{}";
          // Try to extract JSON from the response (may be wrapped in markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          extractedResponses = parsed.responses || [];
        } catch (e) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível processar o PDF. Tente novamente." });
        }

        // Create a new submission for this historical ficha
        const [result] = await database!.insert(schema.weeklySubmissions).values({
          projectId: input.projectId,
          companyId: (ctx.user as any).companyId || null,
          weekNumber: input.weekNumber,
          weekYear: input.year,
          weekStartDate: "01.01." + input.year,
          weekEndDate: "07.01." + input.year,
          status: "approved", // Historical fichas are already approved
          createdBy: ctx.user.id,
          submittedBy: ctx.user.id,
          submittedAt: Date.now(),
          reviewedBy: ctx.user.id,
          reviewedAt: Date.now(),
          reviewNotes: "Importado via PDF histórico",
        }).$returningId();
        
        const submissionId = result.id;
        
        // Save each extracted response
        const responseIds: { measureId: number; responseId: number }[] = [];
        for (const resp of extractedResponses) {
          if (resp.measureId && resp.status) {
            const [resResult] = await database!.insert(schema.measureResponses).values({
              submissionId,
              measureId: resp.measureId,
              status: resp.status,
              observations: resp.observations || null,
            }).$returningId();
            responseIds.push({ measureId: resp.measureId, responseId: resResult.id });
          }
        }
        
        // Upload extracted images as evidence photos
        let photoCount = 0;
        if (extractedImages.length > 0 && responseIds.length > 0) {
          // Strategy: distribute images across measure responses
          // If LLM returned page info per measure, use that; otherwise distribute evenly
          for (let i = 0; i < extractedImages.length; i++) {
            const img = extractedImages[i];
            // Associate image with the closest measure response (by index distribution)
            const responseIndex = Math.min(
              Math.floor((i / extractedImages.length) * responseIds.length),
              responseIds.length - 1
            );
            const targetResponse = responseIds[responseIndex];

            try {
              const imgFileKey = `evidence/${submissionId}/${Date.now()}_${img.filename}`;
              const { url: imgUrl } = await storagePut(imgFileKey, img.buffer, img.mimeType);
              await database!.insert(schema.evidenceImages).values({
                responseId: targetResponse.responseId,
                fileKey: imgFileKey,
                url: imgUrl,
                filename: img.filename,
                mimeType: img.mimeType,
              });
              photoCount++;
            } catch (e) {
              console.warn(`Failed to upload image ${img.filename}:`, e);
            }
          }
        }

        return {
          success: true,
          submissionId,
          matchedMeasures: extractedResponses.length,
          totalMeasures: allMeasures.length,
          extractedPhotos: photoCount,
        };
      }),
  }),

  // ─── Review Comments ──────────────────────────────────────────────────────
  reviewComments: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA, admin, dono, and the company itself can see comments
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getCommentsBySubmission(input.submissionId);
      }),
    getMeasureReviews: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA, admin, dono, the company itself, and observador can see measure reviews
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getMeasureReviewsBySubmission(input.submissionId);
      }),
    add: protectedProcedure
      .input(z.object({ submissionId: z.number(), measureId: z.number().nullable(), comment: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!canReview(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para comentar." });
        }
        return db.addReviewComment({
          submissionId: input.submissionId,
          measureId: input.measureId,
          userId: ctx.user.id,
          comment: input.comment,
        });
      }),
  }),

  // ─── Measure Responses ─────────────────────────────────────────────────────
  responses: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // RAA can view all responses
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getResponsesBySubmission(input.submissionId);
      }),

    // Get responses for multiple submissions at once (for RDCD report)
    getBySubmissions: protectedProcedure
      .input(z.object({ submissionIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, DO ou PM podem gerar RDCD" });
        }
        if (input.submissionIds.length === 0) return [];
        const database = await db.getDb();
        if (!database) return [];
        const results = await database.execute(sql`SELECT mr.submissionId, mr.measureId, mr.status, mr.observations FROM measure_responses mr WHERE mr.submissionId IN (${sql.join(input.submissionIds.map(id => sql`${id}`), sql`, `)})`);
        return (results as any)[0] || [];
      }),

    save: protectedProcedure
      .input(
        z.object({
          submissionId: z.number(),
          responses: z.array(
            z.object({
              measureId: z.number(),
              status: z.enum(["I", "C", "NC", "NA"]).nullable(),
              observations: z.string().nullable(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        // Can only edit if draft or rejected
        if (sub.status !== "draft" && sub.status !== "rejected" && !isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficha não pode ser editada neste estado." });
        }
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.bulkUpsertResponses(input.submissionId, input.responses);
        return { success: true };
      }),
  }),

  // ─── Evidence Images ───────────────────────────────────────────────────────
  evidence: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getImagesBySubmission(input.submissionId);
      }),

    // Get evidence images for multiple submissions at once (for RDCD report)
    getBySubmissions: protectedProcedure
      .input(z.object({ submissionIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, DO ou PM" });
        }
        if (input.submissionIds.length === 0) return [];
        const database = await db.getDb();
        if (!database) return [];
        const responsesResult = await database.execute(sql`SELECT id, submissionId, measureId FROM measure_responses WHERE submissionId IN (${sql.join(input.submissionIds.map(id => sql`${id}`), sql`, `)})`);
        const responses = (responsesResult as any)[0] || [];
        if (responses.length === 0) return [];
        const responseIds = responses.map((r: any) => r.id);
        const imagesResult = await database.execute(sql`SELECT ei.id, ei.responseId, ei.url, ei.filename, ei.mimeType FROM evidence_images ei WHERE ei.responseId IN (${sql.join(responseIds.map((id: number) => sql`${id}`), sql`, `)})`);
        const images = (imagesResult as any)[0] || [];
        return images.map((img: any) => {
          const resp = responses.find((r: any) => r.id === img.responseId);
          return { ...img, measureId: resp?.measureId, submissionId: resp?.submissionId };
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const image = await db.getImageById(input.id);
        if (!image) throw new TRPCError({ code: "NOT_FOUND" });
        const response = await db.getResponseById(image.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = await db.getSubmissionById(response.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteEvidenceImage(input.id);
        return { success: true };
      }),
  }),

  // ─── Historical PDFs ──────────────────────────────────────────────────────
  historical: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (isAdminOrDono(ctx.user.role) || ctx.user.role === "raa" || ctx.user.role === "observador") {
          return db.getHistoricalPdfs(input?.companyId);
        }
        if (!ctx.user.companyId) return [];
        return db.getHistoricalPdfs(ctx.user.companyId);
      }),
    upload: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        weekNumber: z.number(),
        weekYear: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && !canSubmitForms(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // EE/RAP can only upload for their own company
        if (!isAdminOrDono(ctx.user.role) && ctx.user.companyId !== input.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize historical document
        const sanitizeResult = await sanitizeFile(buffer, input.mimeType, `historical_S${input.weekNumber}_${input.weekYear}.pdf`);
        await logFileUpload(ctx.user.id, `historical_S${input.weekNumber}_${input.weekYear}`, input.mimeType, sanitizeResult.safe, sanitizeResult.threats, "historical-pdf");
        if (!sanitizeResult.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult.threats[0]}` });
        }
        const company = await db.getCompanyById(input.companyId);
        const companyName = company?.shortName || `EE${input.companyId}`;
        const fileKey = `historical/${input.companyId}/FichaS${String(input.weekNumber).padStart(2, "0")}_${input.weekYear}_${companyName}.pdf`;
        const { key, url } = await storagePut(fileKey, buffer, input.mimeType);

        return db.addHistoricalPdf({
          companyId: input.companyId,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          fileKey: key,
          url,
          filename: input.filename,
          uploadedBy: ctx.user.id,
        });
      }),
  }),

  // ─── Dashboard Analytics ───────────────────────────────────────────────────
  analytics: router({
    overview: protectedProcedure
      .input(
        z.object({
          companyId: z.number().optional(),
          weekYear: z.number().optional(),
          weekNumber: z.number().optional(),
          sectionId: z.number().optional(),
          projectId: z.number().optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        // EE/RAP can only see own company
        const filters = { ...input };
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.companyId) {
          filters.companyId = ctx.user.companyId;
        }
        return db.getAnalytics(filters);
      }),
  }),

  // ─── Profile ───────────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserByOpenId(ctx.user.openId);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        fullName: (user as any).fullName ?? null,
        jobTitle: (user as any).jobTitle ?? null,
        email: user.email,
        role: user.role,
      };
    }),
    update: protectedProcedure
      .input(z.object({
        fullName: z.string().max(255).optional(),
        jobTitle: z.string().max(255).optional(),
        displayName: z.string().max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByOpenId(ctx.user.openId);
        if (!user) throw new Error("User not found");
        await db.updateUserProfile(user.id, {
          fullName: input.fullName ?? null,
          jobTitle: input.jobTitle ?? null,
          name: input.displayName ?? null,
        });
        return { success: true };
      }),
  }),

  // ─── Projects ─────────────────────────────────────────────────────────────
  projects: router({
    list: partnerAllowedProcedure.query(async ({ ctx }) => {
      const allProjects = await db.getAllProjects();
      const role = ctx.user.role;
      // Admin e Dono de Obra mantêm a visão global.
      if (role === "admin" || role === "dono_obra") {
        return allProjects;
      }
      if (role === "pm") {
        const assigned = new Set((await db.getUserProjects(ctx.user.id)).map(item => item.projectId));
        return allProjects.filter(project => assigned.has(project.id));
      }
      if (role === "ee_partner") {
        const profile = await getActivePartnerProfile(ctx.user);
        const allowedIds = new Set(await db.getPartnerAllowedProjectIds(ctx.user.id, profile!.parentCompanyId));
        return allProjects.filter(project => allowedIds.has(project.id) && project.code !== "SIN01");
      }
      // EE/RAP/RAA/observador: only see assigned projects, NEVER SIN01
      const userProjectAssocs = await db.getUserProjects(ctx.user.id);
      const userProjectIds = new Set(userProjectAssocs.map(up => up.projectId));
      // Also check company-level project assignments
      if (ctx.user.companyId) {
        const companyProjectAssocs = await db.getProjectsForCompany(ctx.user.companyId);
        for (const cp of companyProjectAssocs) {
          userProjectIds.add(cp.projectId);
        }
      }
      // If no assignments, return empty (user sees nothing until admin assigns)
      if (userProjectIds.size === 0) {
        return [];
      }
      // Filter to assigned projects and exclude SIN01 for non-admin roles
      return allProjects.filter(p => userProjectIds.has(p.id) && p.code !== "SIN01");
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return assertProjectAccess(ctx.user, input.id);
      }),
    create: adminProcedure
      .input(z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createProject(input);
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1).max(50).optional(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        active: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, data);
        return { success: true };
      }),
    // Company associations
    getCompanies: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "pm") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para listar empresas do projecto." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        return db.getCompaniesForProject(input.projectId);
      }),
    addCompany: adminProcedure
      .input(z.object({ projectId: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await db.addCompanyToProject(input.projectId, input.companyId);
        return { success: true };
      }),
    removeCompany: adminProcedure
      .input(z.object({ projectId: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeCompanyFromProject(input.projectId, input.companyId);
        return { success: true };
      }),
    // User associations
    getUsers: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "pm") throw new TRPCError({ code: "FORBIDDEN" });
        await assertProjectAccess(ctx.user, input.projectId);
        return db.getProjectUsers(input.projectId);
      }),
    // Get all user-project assignments (for admin panel)
    allUserAssignments: adminProcedure.query(async () => {
      return db.getAllUserProjectAssignments();
    }),
    // Get all company-project assignments (for admin panel)
    allCompanyAssignments: adminProcedure.query(async () => {
      return db.getAllCompanyProjectAssignments();
    }),
    // Set user projects (replace all assignments for a user)
    setUserProjects: adminProcedure
      .input(z.object({ userId: z.number(), projectIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        await db.setUserProjects(input.userId, input.projectIds);
        return { success: true };
      }),
    // Set company projects (replace all assignments for a company)
    setCompanyProjects: adminProcedure
      .input(z.object({ companyId: z.number(), projectIds: z.array(z.number().int().positive()).min(1, "Seleccione pelo menos um projecto.") }))
      .mutation(async ({ input }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        if (company.companyType === "ee_partner") {
          const profile = await db.getPartnerCompanyProfile(input.companyId);
          if (!profile) throw new TRPCError({ code: "CONFLICT", message: "Configure primeiro a EE principal desta EEP." });
          const parentProjects = await db.getProjectsForCompany(profile.parentCompanyId);
          const allowedIds = new Set(parentProjects.map(item => item.projectId));
          if (input.projectIds.some(projectId => !allowedIds.has(projectId))) throw new TRPCError({ code: "FORBIDDEN", message: "A EEP só pode receber projectos da sua EE principal." });
        }
        await db.setCompanyProjects(input.companyId, input.projectIds);
        return { success: true };
      }),
    addUser: adminProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.addUserToProject(input.projectId, input.userId);
        return { success: true };
      }),
    removeUser: adminProcedure
      .input(z.object({ projectId: z.number(), userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeUserFromProject(input.projectId, input.userId);
        return { success: true };
      }),
  }),

  // ─── Deletion Logs ──────────────────────────────────────────────────────────
  deletionLogs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Only admin and dono_obra can see deletion logs
      if (ctx.user.role !== "admin" && ctx.user.role !== "dono_obra") {
        return [];
      }
      return db.getDeletionLogs();
    }),
  }),

  // ─── Matrix (Acompanhamento) ──────────────────────────────────────────────
  matrix: router({
    getData: protectedProcedure
      .input(z.object({ projectId: z.number().optional(), year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // All authenticated users can view the matrix
        return db.getMatrixData(input?.projectId, input?.year);
      }),
  }),

  // ─── Evidence Files (ficheiros por medida) ────────────────────────────────
  files: router({
    upload: protectedProcedure
      .input(z.object({
        submissionId: z.number(),
        measureId: z.number(),
        filename: z.string(),
        mimeType: z.string(),
        data: z.string(), // base64
        fileSize: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Decode base64
        // Security: validate file type and size
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido" });
        if (input.data.length > MAX_FILE_SIZE_B64) throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)" });
        const buffer = Buffer.from(input.data, "base64");
        // Security: sanitize evidence file
        const sanitizeResult2 = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitizeResult2.safe, sanitizeResult2.threats, "evidence-upload");
        if (!sanitizeResult2.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitizeResult2.threats[0]}` });
        }
        const timestamp = new Date().toISOString().slice(0, 10);
        const ext = input.filename.split(".").pop() || "bin";
        const fileKey = `files/${input.submissionId}/Medida${input.measureId}_${timestamp}.${ext}`;
        const contentType = input.mimeType || "application/octet-stream";

        const { storagePut } = await import("./storage");
        const { key, url } = await storagePut(fileKey, buffer, contentType);

        // Ensure measure response exists
        const { id: responseId } = await db.upsertMeasureResponse({
          submissionId: input.submissionId,
          measureId: input.measureId,
          status: null,
          observations: null,
        });

        const result = await db.addEvidenceFile({
          responseId,
          fileKey: key,
          url,
          filename: input.filename,
          mimeType: contentType,
          fileSize: input.fileSize || buffer.length,
        });

        return { id: result.id, url, fileKey: key, filename: input.filename };
      }),

    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getFilesBySubmission(input.submissionId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const file = await db.getFileById(input.id);
        if (!file) throw new TRPCError({ code: "NOT_FOUND" });
        const response = await db.getResponseById(file.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = await db.getSubmissionById(response.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteEvidenceFile(input.id);
        return { success: true };
      }),
  }),

  // ─── Workflow por Projeto ─────────────────────────────────────────────────
  workflow: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        return { projectId: project.id, workflowDescription: project.workflowDescription || "" };
      }),

    update: protectedProcedure
      .input(z.object({ projectId: z.number(), workflowDescription: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem editar o workflow" });
        }
        await db.updateProjectWorkflow(input.projectId, input.workflowDescription);
        return { success: true };
      }),
  }),

  // ─── Overdue Detection (3 semanas sem ficha) ──────────────────────────────
  overdue: router({
    check: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // Only show overdue to admin, dono_obra, raa (and EE/RAP for their own company)
        // Calculate current week
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
        const currentWeek = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
        const currentYear = now.getFullYear();

        // Get all active EE/RAP companies (optionally filtered by project)
        const matrixData = await db.getMatrixData(input?.projectId);
        const { submissions, companies } = matrixData;

        // For each company, find the latest submission week
        const overdueCompanies: Array<{
          companyId: number;
          companyName: string;
          companyType: string;
          weeksBehind: number;
          lastWeekKey: string | null;
        }> = [];

        for (const company of companies) {
          const companySubs = submissions.filter(s => s.companyId === company.id && s.status !== "draft");
          let lastWeekNum = 0;
          let lastWeekYear = 0;
          let lastWeekKey: string | null = null;

          for (const sub of companySubs) {
            if (sub.weekYear > lastWeekYear || (sub.weekYear === lastWeekYear && sub.weekNumber > lastWeekNum)) {
              lastWeekNum = sub.weekNumber;
              lastWeekYear = sub.weekYear;
              lastWeekKey = sub.weekKey;
            }
          }

          // Calculate weeks behind
          let weeksBehind = 0;
          if (lastWeekYear === 0) {
            // Never submitted - only flag if there are ANY submissions in this project
            // (meaning the project is active and others have submitted)
            const anyProjectSubs = submissions.filter(s => s.status !== "draft");
            if (anyProjectSubs.length === 0) {
              continue; // Project has no submissions at all, skip
            }
            // Find the earliest submission in the project to determine project start
            let earliestWeekNum = 99;
            let earliestWeekYear = 9999;
            for (const s of anyProjectSubs) {
              if (s.weekYear < earliestWeekYear || (s.weekYear === earliestWeekYear && s.weekNumber < earliestWeekNum)) {
                earliestWeekNum = s.weekNumber;
                earliestWeekYear = s.weekYear;
              }
            }
            const totalWeeksNow = currentYear * 52 + currentWeek;
            const totalWeeksEarliest = earliestWeekYear * 52 + earliestWeekNum;
            weeksBehind = totalWeeksNow - totalWeeksEarliest;
          } else {
            // Calculate difference in weeks
            const totalWeeksNow = currentYear * 52 + currentWeek;
            const totalWeeksLast = lastWeekYear * 52 + lastWeekNum;
            weeksBehind = totalWeeksNow - totalWeeksLast;
          }

          if (weeksBehind >= 3) {
            // For EE/RAP users, only show their own company
            if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa") {
              if (ctx.user.companyId !== company.id) continue;
            }
            overdueCompanies.push({
              companyId: company.id,
              companyName: company.shortName,
              companyType: company.companyType,
              weeksBehind,
              lastWeekKey,
            });
          }
        }

        return { overdueCompanies, currentWeek, currentYear };
      }),
  }),

  // ─── Monitoring Plans (Planos de Monitorização) ─────────────────────────────
  monitoringPlans: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async () => db.getMonitoringPlanOverview()),

    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos." });
        }
        const allUsers = await db.getAllUsers();
        return allUsers
          .filter(candidate => candidate.accountStatus === "active" && candidate.email)
          .map(candidate => ({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email!, role: candidate.role }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        planNumber: z.string().trim().min(1).max(50).optional(),
        name: z.string().min(1),
        category: z.enum(["programa_monitorizacao", "plano_projeto"]),
        periodicity: z.string().optional(),
        phase: z.string().default("construcao"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem criar planos" });
        }
        const id = await db.createMonitoringPlan({
          projectId: null,
          planNumber: input.planNumber ?? null,
          name: input.name,
          category: input.category,
          periodicity: input.periodicity ?? null,
          phase: input.phase,
          notes: input.notes ?? null,
          active: 1,
          lastReportingDate: null,
          nextReportingDate: null,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        planNumber: z.string().trim().min(1).max(50).optional(),
        name: z.string().optional(),
        periodicity: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem editar planos" });
        }
        const { id, ...data } = input;
        await db.updateMonitoringPlan(id, data as any);
        return { success: true };
      }),

    configure: protectedProcedure
      .input(z.object({
        planId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
        nextReportingDate: z.number().nullable().optional(),
        lastReportingDate: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis e prazos." });
        }
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });

        let ownerName: string | null | undefined = undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) {
            ownerName = null;
          } else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            ownerName = getUserDisplayName(owner);
          }
        }

        const changes: any = {};
        if (input.ownerId !== undefined) {
          changes.ownerId = input.ownerId;
          changes.ownerName = ownerName;
        }
        if (input.nextReportingDate !== undefined) changes.nextReportingDate = input.nextReportingDate;
        if (input.lastReportingDate !== undefined) changes.lastReportingDate = input.lastReportingDate;
        if (input.supportName !== undefined) changes.supportName = input.supportName;
        if (input.supportCompany !== undefined) changes.supportCompany = input.supportCompany;
        if (input.supportEmail !== undefined) changes.supportEmail = input.supportEmail;
        if (input.supportPhone !== undefined) changes.supportPhone = input.supportPhone;
        await db.updateMonitoringPlan(plan.id, changes);
        await db.syncMonitoringPlanCalendarEvent(plan.id);

        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "monitoring_plan_configured",
          entity: "monitoring_plan",
          entityId: plan.id,
          newValue: JSON.stringify(changes),
        });
        return { success: true, planId: plan.id };
      }),

    addUpdate: protectedProcedure
      .input(z.object({
        planId: z.number(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar este plano." });
        }
        const updateId = await db.addMonitoringPlanUpdate({
          assignmentId: null,
          planId: plan.id,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        await db.updateMonitoringPlan(plan.id, { trackingStatus: input.status });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "monitoring_plan_status_update",
          entity: "monitoring_plan",
          entityId: plan.id,
          newValue: JSON.stringify({ updateId, status: input.status }),
        });
        return { success: true, updateId };
      }),

    history: protectedProcedure
      .input(z.object({ planId: z.number(), projectId: z.number().optional() }))
      .query(async ({ input }) => {
        return {
          updates: await db.getMonitoringPlanUpdates(input.planId),
          attachments: await db.getMonitoringPlanAttachments(input.planId),
        };
      }),

    uploadAttachment: protectedProcedure
      .input(z.object({
        planId: z.number(),
        projectId: z.number().optional(),
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(100),
        fileBase64: z.string().min(1).max(MAX_FILE_SIZE_B64),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan || !plan.active) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para anexar ficheiros a este plano." });
        }
        if (!ALLOWED_FILE_TYPES.has(input.mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de ficheiro não permitido." });
        }
        const buffer = Buffer.from(input.fileBase64, "base64");
        if (buffer.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficheiro demasiado grande (máx. 10MB)." });
        }
        const sanitized = await sanitizeFile(buffer, input.mimeType, input.filename);
        await logFileUpload(ctx.user.id, input.filename, input.mimeType, sanitized.safe, sanitized.threats, "monitoring-plan");
        if (!sanitized.safe) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Ficheiro rejeitado por segurança: ${sanitized.threats[0]}` });
        }
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
        const fileKey = `monitoring-plans/${plan.id}/${Date.now()}-${safeFilename}`;
        const stored = await storagePut(fileKey, buffer, input.mimeType);
        const attachmentId = await db.addMonitoringPlanAttachment({
          assignmentId: null,
          planId: plan.id,
          updateId: null,
          type: input.mimeType.startsWith("image/") ? "photo" : "file",
          fileKey: stored.key,
          url: stored.url,
          filename: input.filename,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id,
          uploadedByName: getUserDisplayName(ctx.user),
        });
        return { success: true, attachmentId, url: stored.url };
      }),

    confirmDelivery: protectedProcedure
      .input(z.object({ planId: z.number(), projectId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMonitoringPlanById(input.planId);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
        if (!canUpdatePlanProgress(ctx.user, plan)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para confirmar esta entrega." });
        }

        const now = Date.now();
        let nextDate: number | null = null;
        const periodicity = (plan.periodicity || "").toLowerCase();
        if (periodicity.includes("anual") || periodicity.includes("annual")) {
          nextDate = now + 365 * 24 * 60 * 60 * 1000; // +1 year
        } else if (periodicity.includes("semestral")) {
          nextDate = now + 182 * 24 * 60 * 60 * 1000; // +6 months
        } else if (periodicity.includes("trimestral")) {
          nextDate = now + 91 * 24 * 60 * 60 * 1000; // +3 months
        } else if (periodicity.includes("trienal") || periodicity.includes("3 anos") || periodicity.includes("3 em 3")) {
          nextDate = now + 3 * 365 * 24 * 60 * 60 * 1000; // +3 years
        } else {
          // Default: +1 year
          nextDate = now + 365 * 24 * 60 * 60 * 1000;
        }

        await db.updateMonitoringPlan(plan.id, {
          submissionStatus: "delivered",
          confirmedDeliveryAt: now,
          lastReportingDate: now,
          nextReportingDate: nextDate,
        });
        await db.syncMonitoringPlanCalendarEvent(plan.id);
        return { success: true, nextReportingDate: nextDate };
      }),
  }),

  // ─── Project Phases ─────────────────────────────────────────────────────────
  projectPhases: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        return await db.getProjectPhases(input.projectId);
      }),

    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar fases de todos os projectos." });
        }
        return await db.getAllProjectPhases();
      }),
    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        const allUsers = await db.getAllUsers();
        const candidates: Array<{ id: number; name: string; email: string; role: string }> = [];
        for (const candidate of allUsers) {
          if (candidate.accountStatus !== "active" || !candidate.email) continue;
          try {
            await assertProjectAccess(candidate, input.projectId);
            candidates.push({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email, role: candidate.role });
          } catch {
            // Não expor utilizadores sem acesso ao projecto.
          }
        }
        return candidates.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),
    configureTracking: protectedProcedure
      .input(z.object({
        phaseId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis das fases." });
        }
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectAccess(ctx.user, phase.projectId);

        let ownerName: string | null | undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) ownerName = null;
          else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            await assertProjectAccess(owner, phase.projectId);
            ownerName = getUserDisplayName(owner);
          }
        }

        const changes: any = {};
        if (input.ownerId !== undefined) { changes.ownerId = input.ownerId; changes.ownerName = ownerName; }
        if (input.supportName !== undefined) changes.supportName = input.supportName;
        if (input.supportCompany !== undefined) changes.supportCompany = input.supportCompany;
        if (input.supportEmail !== undefined) changes.supportEmail = input.supportEmail;
        if (input.supportPhone !== undefined) changes.supportPhone = input.supportPhone;
        await db.updateProjectPhaseTracking(phase.id, changes);

        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "project_phase_configured",
          entity: "project_phase",
          entityId: phase.id,
          newValue: JSON.stringify(changes),
        });
        return { success: true };
      }),
    addStatusUpdate: protectedProcedure
      .input(z.object({
        phaseId: z.number(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectAccess(ctx.user, phase.projectId);
        if (!canUpdatePlanProgress(ctx.user, phase)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta fase." });
        }
        const updateId = await db.addProjectPhaseUpdate({
          phaseId: phase.id,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        await db.updateProjectPhaseTracking(phase.id, { trackingStatus: input.status });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "project_phase_status_update",
          entity: "project_phase",
          entityId: phase.id,
          newValue: JSON.stringify({ updateId, status: input.status }),
        });
        return { success: true, updateId };
      }),
    updateHistory: protectedProcedure
      .input(z.object({ phaseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const phase = await db.getProjectPhaseById(input.phaseId);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada." });
        await assertProjectAccess(ctx.user, phase.projectId);
        return db.getProjectPhaseUpdates(phase.id);
      }),
    updateSettings: protectedProcedure
      .input(z.object({ id: z.number(), startDate: z.string().optional(), endDate: z.string().optional(), hidden: z.number().optional(), progress: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.execute(sql`UPDATE project_phases SET startDate = ${data.startDate || null}, endDate = ${data.endDate || null}, hidden = COALESCE(${data.hidden ?? null}, hidden), progress = COALESCE(${data.progress ?? null}, progress) WHERE id = ${id}`);
        return { success: true };
      }),
  }),

  phaseMeasures: router({
    getAllProjectsProgress: protectedProcedure
      .query(async () => {
        // Get all projects
        const allProjects = await db.getAllProjects();
        // Get all phase measure statuses for all projects
        const results: any[] = [];
        const allSections = await db.getAllSections();
        const allMeasures = await db.getAllMeasures();

        const ppDb = await db.getDb(); const allProjectPhases = ppDb ? await ppDb.select().from(schema.projectPhases) : [];
        for (const proj of allProjects) {
          const statuses = await db.getPhaseMeasureStatuses(proj.id);
          const projPhases = allProjectPhases.filter((pp: any) => pp.projectId === proj.id);
          const statusMap = new Map<number, string>();
          statuses.forEach((s: any) => statusMap.set(s.measureId, s.trackingStatus));

          const phases: any[] = [];
          const PHASE_KEYS = ["Prévias Licenciamento", "Em Sede de Licenciamento", "Pré-Construção", "Preparação Prévia", "Execução da Obra", "Fase Final", "Fase Final Construção", "Exploração", "Desativação (Pós-Exploração)"];

          for (const phaseKey of PHASE_KEYS) {
            const phaseSections = allSections.filter((s: any) => s.phase === phaseKey);
            const sectionIds = new Set(phaseSections.map((s: any) => s.id));
            const phaseMeasures = allMeasures.filter((m: any) => sectionIds.has(m.sectionId));
            const total = phaseMeasures.length;
            if (total === 0) continue;
            const concluido = phaseMeasures.filter((m: any) => statusMap.get(m.id) === "concluido").length;
            const ppMatch = projPhases.find((pp: any) => pp.phaseKey === phaseKey || pp.phaseName === phaseKey);
            phases.push({ key: phaseKey, total, concluido, progress: Math.round((concluido / total) * 100), endDate: ppMatch?.endDate || null });
          }
          results.push({ projectId: proj.id, code: proj.code, phases });
        }
        return results;
      }),

    getStatuses: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        return await db.getPhaseMeasureStatuses(input.projectId);
      }),

    responsibleCandidates: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem consultar responsáveis internos das medidas." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        const allUsers = await db.getAllUsers();
        const candidates: Array<{ id: number; name: string; email: string; role: string }> = [];
        for (const candidate of allUsers) {
          if (candidate.accountStatus !== "active" || !candidate.email) continue;
          try {
            await assertProjectAccess(candidate, input.projectId);
            candidates.push({ id: candidate.id, name: getUserDisplayName(candidate), email: candidate.email, role: candidate.role });
          } catch {
            // Não expor utilizadores sem acesso ao projecto da medida.
          }
        }
        return candidates.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      }),

    configureTracking: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        ownerId: z.number().nullable().optional(),
        supportName: z.string().trim().max(255).nullable().optional(),
        supportCompany: z.string().trim().max(255).nullable().optional(),
        supportEmail: z.string().trim().email().max(320).nullable().optional(),
        supportPhone: z.string().trim().max(80).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem configurar responsáveis das medidas." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });

        let ownerName: string | null | undefined;
        if (input.ownerId !== undefined) {
          if (input.ownerId === null) ownerName = null;
          else {
            const owner = await db.getUserById(input.ownerId);
            if (!owner || owner.accountStatus !== "active" || !owner.email) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável seleccionado não está activo ou não tem email." });
            }
            await assertProjectAccess(owner, input.projectId);
            ownerName = getUserDisplayName(owner);
          }
        }

        await db.configurePhaseMeasureTracking({
          projectId: input.projectId,
          measureId: input.measureId,
          ownerId: input.ownerId,
          ownerName,
          supportName: input.supportName,
          supportCompany: input.supportCompany,
          supportEmail: input.supportEmail,
          supportPhone: input.supportPhone,
          updatedBy: ctx.user.id,
        });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "phase_measure_tracking_configured",
          entity: "phase_measure_status",
          entityId: input.measureId,
          newValue: JSON.stringify({ projectId: input.projectId, ownerId: input.ownerId, ownerName, supportName: input.supportName, supportCompany: input.supportCompany, supportEmail: input.supportEmail, supportPhone: input.supportPhone }),
        });
        return { success: true };
      }),

    addStatusUpdate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        measureId: z.number(),
        status: z.enum(["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]),
        updateText: z.string().trim().min(3).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });
        const tracking = await db.getPhaseMeasureStatus(input.projectId, input.measureId);
        if (!(isAdminOrDono(ctx.user.role) || ctx.user.role === "raa" || tracking?.ownerId === ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o responsável, a RAA, Admin ou Dono de Obra podem actualizar esta medida." });
        }
        const updateId = await db.addPhaseMeasureUpdate({
          projectId: input.projectId,
          measureId: input.measureId,
          status: input.status,
          updateText: input.updateText,
          createdBy: ctx.user.id,
          createdByName: getUserDisplayName(ctx.user),
        });
        const database = await db.getDb();
        if (database) await database.insert(schema.auditLog).values({
          userId: ctx.user.id,
          userName: getUserDisplayName(ctx.user),
          action: "phase_measure_status_update",
          entity: "phase_measure_status",
          entityId: input.measureId,
          newValue: JSON.stringify({ projectId: input.projectId, status: input.status, updateId }),
        });
        return { success: true, updateId };
      }),

    updateHistory: protectedProcedure
      .input(z.object({ projectId: z.number(), measureId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        const measure = await db.getMeasureById(input.measureId);
        if (!measure) throw new TRPCError({ code: "NOT_FOUND", message: "Medida não encontrada." });
        return await db.getPhaseMeasureUpdates(input.projectId, input.measureId);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
        status: z.enum(["pendente", "em_curso", "concluido"]),
        notes: z.string().nullable().default(null),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
        }
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: input.status,
          notes: input.notes,
          updatedBy: ctx.user.id,
        });
        return { success: true };
      }),

    setDeliveryDate: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
        firstDeliveryDate: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Set first delivery date and calculate next (+1 year)
        const nextDate = input.firstDeliveryDate + 365 * 24 * 60 * 60 * 1000;
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: "pendente",
          notes: null,
          updatedBy: ctx.user.id,
          firstDeliveryDate: input.firstDeliveryDate,
          nextDeliveryDate: nextDate,
        } as any);
        return { success: true, nextDeliveryDate: nextDate };
      }),

    confirmAnnualDelivery: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProjectAccess(ctx.user, input.projectId);
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Mark as delivered, set next delivery date to +1 year from now
        const now = Date.now();
        const nextDate = now + 365 * 24 * 60 * 60 * 1000;
        await db.upsertPhaseMeasureStatus({
          measureId: input.measureId,
          projectId: input.projectId,
          status: "concluido",
          notes: null,
          updatedBy: ctx.user.id,
          lastDeliveryDate: now,
          nextDeliveryDate: nextDate,
        } as any);
      return { success: true, nextDeliveryDate: nextDate };
      }),
  }),

  // ─── Calendar Events ─────────────────────────────────────────────────────────
  calendarEvents: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await db.getCalendarEvents(input?.projectId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await db.getCalendarEvents(undefined, true);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        periodicity: z.string().optional(),
        firstDate: z.number(),
        nextDate: z.number().optional(),
        category: z.string().optional(),
        entityToDeliver: z.string().optional(),
        entityLink: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
        }
        const id = await db.createCalendarEvent({
          projectId: input.projectId ?? null,
          name: input.name,
          description: input.description ?? null,
          periodicity: input.periodicity ?? null,
          firstDate: input.firstDate,
          nextDate: input.nextDate ?? input.firstDate,
          category: input.category ?? null,
          entityToDeliver: input.entityToDeliver ?? null,
          entityLink: input.entityLink ?? null,
          createdBy: ctx.user.id,
          active: 1,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        periodicity: z.string().optional(),
        firstDate: z.number().optional(),
        nextDate: z.number().optional(),
        category: z.string().optional(),
        entityToDeliver: z.string().optional(),
        entityLink: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este prazo é gerido no módulo Planos. Actualize-o nessa página." });
        }
        const { id, ...data } = input;
        await db.updateCalendarEvent(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este prazo é gerido no módulo Planos e não pode ser eliminado no calendário global." });
        }
        await db.deleteCalendarEvent(input.id);
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "reported", "confirmed"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const sourceEvent = await db.getCalendarEventById(input.id);
        if (sourceEvent?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O estado deste prazo deve ser actualizado no módulo Planos." });
        }
        const updateData: any = { status: input.status };
        // When marked as reported OR confirmed, auto-advance date to next period
        if (input.status === "reported" || input.status === "confirmed") {
          const events = await db.getCalendarEvents();
          const evt = events.find(e => e.id === input.id);
          if (evt && input.status === "reported") {
            // Calculate next date from the CURRENT nextDate (not today)
            // e.g., if nextDate was March 2026 and periodicity is annual, next = March 2027
            const baseDate = evt.nextDate || Date.now();
            let nextDate = baseDate + 365 * 24 * 60 * 60 * 1000; // default +1 year
            const periodicity = (evt.periodicity || "").toLowerCase();
            if (periodicity.includes("semestral")) nextDate = baseDate + 182 * 24 * 60 * 60 * 1000;
            else if (periodicity.includes("trimestral")) nextDate = baseDate + 91 * 24 * 60 * 60 * 1000;
            else if (periodicity.includes("mensal")) nextDate = baseDate + 30 * 24 * 60 * 60 * 1000;
            updateData.lastDeliveredDate = Date.now();
            updateData.nextDate = nextDate;
            updateData.status = "pending"; // Reset to pending for next cycle with new date
          }
        }
        await db.updateCalendarEvent(input.id, updateData);
        return { success: true };
      }),

    assignOwner: protectedProcedure
      .input(z.object({
        id: z.number(),
        ownerId: z.number(),
        ownerName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const current = await db.getCalendarEventById(input.id);
        if (current?.sourceType === "monitoring_plan_assignment") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável deste prazo deve ser definido no módulo Planos." });
        }
        await db.updateCalendarEvent(input.id, { ownerId: input.ownerId, ownerName: input.ownerName });
        return { success: true };
      }),
  }),

  wasteEgars: router({
    subprojects: partnerAllowedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        return db.getWasteSubprojects(input.projectId);
      }),
    createSubproject: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(1).max(255), code: z.string().trim().max(80).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin, Dono de Obra ou a EE podem criar subprojectos." });
        }
        await assertProjectAccess(ctx.user, input.projectId);
        if (ctx.user.role === "ee") {
          const companyProjects = ctx.user.companyId ? await db.getProjectsForCompany(ctx.user.companyId) : [];
          if (!companyProjects.some(item => item.projectId === input.projectId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "A sua EE não está associada a este projecto." });
          }
        }
        return db.createWasteSubproject({ projectId: input.projectId, name: input.name, code: input.code || null, active: true, createdBy: ctx.user.id });
      }),
    archiveSubproject: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.archiveWasteSubproject(input.id);
        return { success: true };
      }),
    list: partnerAllowedProcedure
      .input(z.object({ projectId: z.number(), year: z.number().optional(), subProjectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        if (ctx.user.role === "ee_partner") {
          if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Parceiro sem empresa associada." });
          return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId, companyId: ctx.user.companyId });
        }
        if (ctx.user.role === "ee" && ctx.user.companyId) {
          return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId, networkCompanyId: ctx.user.companyId });
        }
        return db.getWasteEgars(input.projectId, input.year, { subProjectId: input.subProjectId });
      }),
    create: partnerAllowedProcedure
      .input(z.object({
        projectId: z.number(),
        subProjectId: z.number().int().positive().optional(),
        companyId: z.number().int().positive().optional(),
        date: z.number(),
        egarId: z.string().optional(),
        egarLink: z.string().optional(),
        operator: z.string().optional(),
        lerCode: z.string().min(1),
        designation: z.string().min(1),
        quantity: z.string().min(1),
        correctedQuantity: z.string().optional(),
        destination: z.enum(["recycled", "incinerated", "landfill"]).optional(),
        month: z.number(),
        year: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee" && ctx.user.role !== "ee_partner") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para registar Resíduos." });
        }
        const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "waste");
        if (input.subProjectId) {
          const subProject = await db.getWasteSubprojectById(input.subProjectId);
          if (!subProject || subProject.projectId !== input.projectId || !subProject.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Subprojecto inválido para o projecto seleccionado." });
          }
        }
        let contributorCompanyId = input.companyId ?? ctx.user.companyId ?? null;
        let parentCompanyId: number | null = contributorCompanyId;
        if (ctx.user.role === "ee_partner") {
          contributorCompanyId = ctx.user.companyId;
          parentCompanyId = profile!.parentCompanyId;
        } else if (ctx.user.role === "ee") {
          contributorCompanyId = ctx.user.companyId;
          parentCompanyId = ctx.user.companyId;
        }
        const result = await db.createWasteEgar({
          ...input,
          subProjectId: input.subProjectId ?? null,
          companyId: contributorCompanyId,
          parentCompanyId,
          egarId: input.egarId ?? null,
          egarLink: input.egarLink ?? null,
          operator: input.operator ?? null,
          correctedQuantity: input.correctedQuantity || null,
          destination: input.destination ?? "recycled",
          createdBy: ctx.user.id,
        });
        // Archive waste eGAR to external storage
        try {
          const { archiveDocument } = await import("./archive-provider");
          const project = await db.getProjectById(input.projectId);
          await archiveDocument("residuo", project?.code || "UNKNOWN", input.year, {
            ...input, id: result.id, createdBy: ctx.user.id,
          }, { month: input.month, year: input.year, lerCode: input.lerCode });
        } catch (e) { console.warn("Waste archive failed (non-fatal):", e); }
        return result;
      }),
    delete: partnerAllowedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const record = await db.getWasteEgarById(input.id);
        if (!record) throw new TRPCError({ code: "NOT_FOUND" });
        await assertPartnerProjectModuleAccess(ctx.user, record.projectId, "waste");
        const ownsRecord = record.createdBy === ctx.user.id || (!!ctx.user.companyId && record.companyId === ctx.user.companyId);
        if (!isAdminOrDono(ctx.user.role) && !ownsRecord) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Só pode eliminar registos da sua entidade." });
        }
        await db.deleteWasteEgar(input.id);
        return { success: true };
      }),
  }),

  partnerDashboard: router({
    entities: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const assigned = await db.getProjectsForCompany(ctx.user.companyId);
      if (!assigned.some(item => item.projectId === input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "A sua EE não está associada a este projecto." });
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`
        SELECT c.id, c.name, c.shortName, 'ee' AS entityType, 1 AS allowKpi, 1 AS allowWaste
        FROM companies c WHERE c.id = ${ctx.user.companyId} AND c.active = 1
        UNION ALL
        SELECT c.id, c.name, c.shortName, 'eep' AS entityType, p.allowKpi, p.allowWaste
        FROM partner_company_profiles p
        JOIN companies c ON c.id = p.companyId AND c.active = 1
        JOIN project_companies pc ON pc.companyId = c.id AND pc.projectId = ${input.projectId}
        WHERE p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1
        ORDER BY entityType ASC, shortName ASC`);
      return (rows as any)[0] || [];
    }),
    kpiMatrix: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), startWeek: z.number().int().min(1).max(53).default(1), endWeek: z.number().int().min(1).max(53).default(53) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`
        SELECT ks.id, ks.companyId, c.shortName, ks.weekNumber, ks.weekYear, ks.status, ks.updatedAt
        FROM kpi_submissions ks JOIN companies c ON c.id = ks.companyId
        WHERE ks.projectId = ${input.projectId} AND ks.weekYear = ${input.year}
          AND ks.weekNumber BETWEEN ${input.startWeek} AND ${input.endWeek}
          AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})
        ORDER BY ks.weekNumber ASC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
    kpiSeries: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), companyId: z.number().int().positive().nullable().default(null) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.companyId) {
        const allowed = await database.execute(sql`SELECT c.id FROM companies c LEFT JOIN partner_company_profiles p ON p.companyId = c.id WHERE c.id = ${input.companyId} AND (c.id = ${ctx.user.companyId} OR (p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1)) LIMIT 1`);
        if (!(allowed as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "Entidade fora da rede da sua EE." });
      }
      let companyScope = sql` AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      if (input.companyId) companyScope = sql` AND ks.companyId = ${input.companyId}`;
      const [metrics, values] = await Promise.all([
        database.execute(sql`SELECT id, name, unit, target, category, sortOrder FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder ASC, id ASC`),
        database.execute(sql`SELECT kv.metricId, kv.value, ks.companyId, c.shortName, ks.weekNumber, ks.weekYear FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId} AND ks.weekYear = ${input.year}${companyScope} ORDER BY kv.metricId, ks.weekNumber, c.shortName`),
      ]);
      return { metrics: (metrics as any)[0] || [], values: (values as any)[0] || [] };
    }),
    wasteMap: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), year: z.number().int().min(2020).max(2100), companyId: z.number().int().positive().nullable().default(null) })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "ee" || !ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard exclusivo da EE." });
      await assertProjectAccess(ctx.user, input.projectId);
      const database = await db.getDb(); if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.companyId) {
        const allowed = await database.execute(sql`SELECT c.id FROM companies c LEFT JOIN partner_company_profiles p ON p.companyId = c.id WHERE c.id = ${input.companyId} AND (c.id = ${ctx.user.companyId} OR (p.parentCompanyId = ${ctx.user.companyId} AND p.active = 1)) LIMIT 1`);
        if (!(allowed as any)[0]?.length) throw new TRPCError({ code: "FORBIDDEN", message: "Entidade fora da rede da sua EE." });
      }
      let companyScope = sql` AND (we.companyId = ${ctx.user.companyId} OR we.parentCompanyId = ${ctx.user.companyId})`;
      if (input.companyId) companyScope = sql` AND we.companyId = ${input.companyId}`;
      const rows = await database.execute(sql`SELECT we.id, we.companyId, c.shortName, we.subProjectId, sp.name AS subProjectName, sp.code AS subProjectCode, we.lerCode, we.designation, we.quantity, we.correctedQuantity, we.destination, we.month, we.year FROM waste_egars we JOIN companies c ON c.id = we.companyId LEFT JOIN waste_subprojects sp ON sp.id = we.subProjectId WHERE we.projectId = ${input.projectId} AND we.year = ${input.year}${companyScope} ORDER BY we.month ASC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
  }),

  // ─── Private project map ──────────────────────────────────────────────────
  projectMap: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        assertMapReadRole(ctx.user.role);
        await assertProjectAccess(ctx.user, input.projectId);
        const [setting, surveys] = await Promise.all([
          db.getProjectMapSetting(input.projectId),
          db.getMapSurveys(input.projectId),
        ]);
        const items = await Promise.all(surveys.map(async survey => {
          const [photos, job] = await Promise.all([
            db.getMapPhotos(survey.id),
            db.getPhotogrammetryJobBySurvey(survey.id),
          ]);
          return { ...survey, photoCount: photos.length, job: job ?? null };
        }));
        return { setting: effectiveProjectMapSetting(input.projectId, setting), surveys: items, worker: getPhotogrammetryWorkerStatus() };
      }),
    survey: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        assertMapReadRole(ctx.user.role);
        const survey = await db.getMapSurveyById(input.id);
        if (!survey) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(ctx.user, survey.projectId);
        const [photos, setting, job] = await Promise.all([
          db.getMapPhotos(survey.id),
          db.getProjectMapSetting(survey.projectId),
          db.getPhotogrammetryJobBySurvey(survey.id),
        ]);
        return { survey, photos, job: job ?? null, setting: effectiveProjectMapSetting(survey.projectId, setting), worker: getPhotogrammetryWorkerStatus() };
      }),
    workerStatus: protectedProcedure.query(({ ctx }) => {
      assertMapReadRole(ctx.user.role);
      return getPhotogrammetryWorkerStatus();
    }),
    createSurvey: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(1).max(255), capturedAt: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        await assertProjectAccess(ctx.user, input.projectId);
        const result = await db.createMapSurvey({
          projectId: input.projectId,
          name: input.name,
          capturedAt: input.capturedAt ?? Date.now(),
          status: "draft",
          resultType: "photo_layers",
          createdBy: ctx.user.id,
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "map_survey_created", "map_surveys", result.id, null, JSON.stringify({ projectId: input.projectId, name: input.name }));
        return result;
      }),
    updateBaseMapBounds: protectedProcedure
      .input(z.object({
        projectId: z.number().int().positive(),
        bounds: z.object({ west: z.number().gte(-180).lte(180), south: z.number().gte(-90).lte(90), east: z.number().gte(-180).lte(180), north: z.number().gte(-90).lte(90) }),
      }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        await assertProjectAccess(ctx.user, input.projectId);
        if (input.bounds.west >= input.bounds.east || input.bounds.south >= input.bounds.north) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Os limites geográficos do mapa base são inválidos." });
        }
        const setting = await db.upsertProjectMapSetting({
          projectId: input.projectId,
          baseMapFileKey: DEFAULT_PROJECT_MAP.fileKey,
          baseMapUrl: DEFAULT_PROJECT_MAP.url,
          boundsJson: JSON.stringify(input.bounds),
          sourceName: DEFAULT_PROJECT_MAP.sourceName,
          sourceUrl: DEFAULT_PROJECT_MAP.sourceUrl,
          attribution: DEFAULT_PROJECT_MAP.attribution,
          license: DEFAULT_PROJECT_MAP.license,
          updatedBy: ctx.user.id,
        });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "map_bounds_updated", "projects", input.projectId, null, JSON.stringify({ bounds: input.bounds, sourceName: DEFAULT_PROJECT_MAP.sourceName }));
        return effectiveProjectMapSetting(input.projectId, setting);
      }),
    uploadPhoto: protectedProcedure
      .input(z.object({
        surveyId: z.number().int().positive(),
        projectId: z.number().int().positive(),
        filename: z.string().min(1).max(255),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(1),
        latitude: z.number().gte(-90).lte(90).optional(),
        longitude: z.number().gte(-180).lte(180).optional(),
        relativeAltitudeM: z.number().positive().max(5000).optional(),
        gimbalYawDegree: z.number().min(-360).max(360).optional(),
        gimbalPitchDegree: z.number().min(-180).max(180).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        const survey = await db.getMapSurveyById(input.surveyId);
        if (!survey || survey.projectId !== input.projectId) throw new TRPCError({ code: "BAD_REQUEST", message: "Levantamento inválido para o projecto." });
        await assertProjectAccess(ctx.user, input.projectId);
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 25 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Cada fotografia não pode exceder 25 MB." });
        const sanitized = await sanitizeFile(buffer, input.mimeType, input.filename);
        if (!sanitized.safe) throw new TRPCError({ code: "BAD_REQUEST", message: sanitized.threats.join("; ") });
        let exif: Record<string, any> = {};
        try {
          const parser = await import("exifr");
          exif = (await parser.parse(buffer, { gps: true, tiff: true, exif: true, xmp: true })) ?? {};
        } catch {
          exif = {};
        }
        const latitude = input.latitude ?? exif.latitude ?? exif.Latitude;
        const longitude = input.longitude ?? exif.longitude ?? exif.Longitude;
        const relativeAltitudeM = input.relativeAltitudeM
          ?? exif.RelativeAltitude
          ?? exif.relativeAltitude
          ?? exif.GPSAltitude
          ?? exif.altitude;
        const imageWidth = Number(exif.ExifImageWidth ?? exif.ImageWidth ?? 0) || null;
        const imageHeight = Number(exif.ExifImageHeight ?? exif.ImageHeight ?? 0) || null;
        const metadata = {
          relativeAltitudeM: relativeAltitudeM == null ? undefined : Number(relativeAltitudeM),
          imageWidth: imageWidth ?? undefined,
          imageHeight: imageHeight ?? undefined,
          gimbalYawDegree: input.gimbalYawDegree
            ?? exif.GimbalYawDegree
            ?? exif.GPSImgDirection,
          gimbalPitchDegree: input.gimbalPitchDegree ?? exif.GimbalPitchDegree,
          gimbalRollDegree: exif.GimbalRollDegree,
          flightYawDegree: exif.FlightYawDegree,
          focalLength35mm: exif.FocalLengthIn35mmFormat,
        };
        const project = await db.getProjectById(input.projectId);
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(`project-maps/${project?.code ?? input.projectId}/survey-${survey.id}/${Date.now()}-${safeFilename}`, buffer, input.mimeType);
        const capturedAt = exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.getTime() : survey.capturedAt ?? Date.now();
        const result = await db.createMapPhoto({
          surveyId: survey.id,
          projectId: input.projectId,
          fileKey: stored.key,
          fileUrl: stored.url,
          filename: input.filename,
          mimeType: input.mimeType,
          latitude: Number.isFinite(Number(latitude)) ? String(Number(latitude)) : null,
          longitude: Number.isFinite(Number(longitude)) ? String(Number(longitude)) : null,
          relativeAltitudeM: Number.isFinite(Number(relativeAltitudeM)) ? String(Number(relativeAltitudeM)) : null,
          imageWidth,
          imageHeight,
          metadataJson: JSON.stringify(metadata),
          capturedAt,
          createdBy: ctx.user.id,
        });
        await db.updateMapSurvey(survey.id, { status: "ready" });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "map_photo_uploaded", "map_photos", result.id, null, JSON.stringify({ projectId: input.projectId, surveyId: survey.id, filename: input.filename, geolocated: !!latitude && !!longitude }));
        return { ...result, geolocated: Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) };
      }),
    validateSurvey: protectedProcedure
      .input(z.object({ surveyId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        const survey = await db.getMapSurveyById(input.surveyId);
        if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "Levantamento não encontrado." });
        await assertProjectAccess(ctx.user, survey.projectId);
        const photos = await db.getMapPhotos(survey.id);
        const validation = validatePhotogrammetryBatch(photos);
        const job = await db.createPhotogrammetryJob({
          surveyId: survey.id,
          projectId: survey.projectId,
          status: validation.accepted ? "ready" : "rejected",
          progress: 0,
          imageCount: validation.imageCount,
          geolocatedCount: validation.geolocatedCount,
          nadirCount: validation.nadirCount,
          obliqueCount: validation.obliqueCount,
          missingMetadataCount: validation.missingMetadataCount,
          validationJson: JSON.stringify(validation),
          optionsJson: JSON.stringify({
            engine: "NodeODM",
            outputs: ["orthophoto", "dsm", "tiles", "quality_report"],
            orthophotoResolutionCm: 5,
            boundaryMode: "project_bounds",
            useExif: true,
          }),
          requestedBy: ctx.user.id,
          errorMessage: validation.accepted ? null : validation.issues.filter(issue => issue.level === "error").map(issue => issue.message).join(" "),
        });
        await db.updateMapSurvey(survey.id, { status: validation.accepted ? "ready" : "failed" });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "photogrammetry_batch_validated", "photogrammetry_jobs", job?.id ?? null, null, JSON.stringify({ surveyId: survey.id, accepted: validation.accepted, imageCount: validation.imageCount }));
        return { job, validation, worker: getPhotogrammetryWorkerStatus() };
      }),
    startProcessing: protectedProcedure
      .input(z.object({ surveyId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        const survey = await db.getMapSurveyById(input.surveyId);
        if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "Levantamento não encontrado." });
        await assertProjectAccess(ctx.user, survey.projectId);
        const job = await db.getPhotogrammetryJobBySurvey(survey.id);
        if (!job || job.status !== "ready") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valide primeiro o lote DJI e corrija os erros detectados." });
        }
        const worker = getPhotogrammetryWorkerStatus();
        if (!worker.configured || !worker.healthy) {
          return { started: false, job, worker };
        }
        return { started: false, job, worker };
      }),
    cancelProcessing: protectedProcedure
      .input(z.object({ surveyId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        const survey = await db.getMapSurveyById(input.surveyId);
        if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "Levantamento não encontrado." });
        await assertProjectAccess(ctx.user, survey.projectId);
        const job = await db.getPhotogrammetryJobBySurvey(survey.id);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job fotogramétrico não encontrado." });
        if (job.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Um processamento concluído não pode ser cancelado." });
        await db.updatePhotogrammetryJob(job.id, { status: "cancelled", finishedAt: new Date() });
        await db.updateMapSurvey(survey.id, { status: "ready" });
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "photogrammetry_job_cancelled", "photogrammetry_jobs", job.id, JSON.stringify({ status: job.status }), JSON.stringify({ status: "cancelled" }));
        return { success: true };
      }),
    deletePhoto: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        assertMapWriteRole(ctx.user.role);
        const photo = await db.getMapPhotoById(input.id);
        if (!photo) throw new TRPCError({ code: "NOT_FOUND" });
        await assertProjectAccess(ctx.user, photo.projectId);
        await db.deleteMapPhoto(photo.id);
        await db.insertAuditLog(ctx.user.id, getUserDisplayName(ctx.user), "map_photo_deleted", "map_photos", photo.id, JSON.stringify({ filename: photo.filename }), null);
        return { success: true };
      }),
  }),

  feedback: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "dono_obra") return [];
      const database = await db.getDb(); if (!database) return []; const result = await database.execute(sql`SELECT * FROM user_feedback ORDER BY createdAt DESC`);
      return (result as any)[0] as any[];
    }),
    create: protectedProcedure.input(z.object({ content: z.string().min(1), category: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const database2 = await db.getDb(); if (!database2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await database2.execute(sql`INSERT INTO user_feedback (userId, userName, userEmail, content, category) VALUES (${ctx.user.id}, ${ctx.user.name}, ${ctx.user.email}, ${input.content}, ${input.category || "melhoria"})`);
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.string(), adminNotes: z.string().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database3 = await db.getDb(); if (!database3) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await database3.execute(sql`UPDATE user_feedback SET status = ${input.status}, adminNotes = ${input.adminNotes || null} WHERE id = ${input.id}`);
      return { success: true };
    }),
  }),

  // ─── KPI's de Sustentabilidade ──────────────────────────────────────────
  kpi: router({
    metrics: partnerAllowedProcedure.query(async ({ ctx }) => {
      await getActivePartnerProfile(ctx.user, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`SELECT * FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder ASC`);
      return (rows as any)[0] || [];
    }),
    matrix: partnerAllowedProcedure.input(z.object({ projectId: z.number() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let scope = sql``;
      if (ctx.user.role === "ee_partner") scope = sql` AND ks.companyId = ${ctx.user.companyId}`;
      else if (ctx.user.role === "ee" && ctx.user.companyId) scope = sql` AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      const rows = await database.execute(sql`SELECT ks.id, ks.companyId, ks.parentCompanyId, ks.sourceType, ks.userId, ks.weekNumber, ks.weekYear, ks.status, ks.createdAt, c.name as companyName, c.shortName, u.name as contributorName FROM kpi_submissions ks JOIN companies c ON c.id = ks.companyId LEFT JOIN users u ON u.id = ks.userId WHERE ks.projectId = ${input.projectId}${scope} ORDER BY ks.weekYear DESC, ks.weekNumber DESC, c.shortName ASC`);
      return (rows as any)[0] || [];
    }),
    values: partnerAllowedProcedure.input(z.object({ submissionId: z.number() })).query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const headers = await database.execute(sql`SELECT projectId, companyId, parentCompanyId FROM kpi_submissions WHERE id = ${input.submissionId} LIMIT 1`);
      const header = (headers as any)[0]?.[0];
      if (!header) throw new TRPCError({ code: "NOT_FOUND" });
      await assertPartnerProjectModuleAccess(ctx.user, Number(header.projectId), "kpi");
      if (ctx.user.role === "ee_partner" && Number(header.companyId) !== Number(ctx.user.companyId)) throw new TRPCError({ code: "FORBIDDEN" });
      if (ctx.user.role === "ee" && Number(header.companyId) !== Number(ctx.user.companyId) && Number(header.parentCompanyId) !== Number(ctx.user.companyId)) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await database.execute(sql`SELECT * FROM kpi_values WHERE submissionId = ${input.submissionId}`);
      return (rows as any)[0] || [];
    }),
    allValues: partnerAllowedProcedure.input(z.object({ projectId: z.number(), weekYear: z.number().optional(), weekNumber: z.number().optional() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let q = sql`SELECT kv.metricId, kv.value, ks.weekNumber, ks.weekYear, ks.companyId, ks.parentCompanyId, ks.sourceType, c.shortName as companyName FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId}`;
      if (ctx.user.role === "ee_partner") q = sql`${q} AND ks.companyId = ${ctx.user.companyId}`;
      else if (ctx.user.role === "ee" && ctx.user.companyId) q = sql`${q} AND (ks.companyId = ${ctx.user.companyId} OR ks.parentCompanyId = ${ctx.user.companyId})`;
      if (input.weekYear) q = sql`${q} AND ks.weekYear = ${input.weekYear}`;
      if (input.weekNumber) q = sql`${q} AND ks.weekNumber = ${input.weekNumber}`;
      const rows = await database.execute(q);
      return (rows as any)[0] || [];
    }),
    submit: partnerAllowedProcedure.input(z.object({ projectId: z.number(), companyId: z.number(), weekNumber: z.number(), weekYear: z.number(), values: z.array(z.object({ metricId: z.number(), value: z.string() })) })).mutation(async ({ ctx, input }) => {
      if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "ee" && ctx.user.role !== "ee_partner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a EE, os parceiros autorizados ou a administração podem submeter KPI." });
      }
      const profile = await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      let contributorCompanyId = input.companyId;
      let parentCompanyId: number | null = input.companyId;
      let sourceType: "ee" | "ee_partner" = "ee";
      let status = "submitted";
      if (ctx.user.role === "ee_partner") {
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Parceiro sem empresa associada." });
        contributorCompanyId = ctx.user.companyId;
        parentCompanyId = profile!.parentCompanyId;
        sourceType = "ee_partner";
        status = "partial";
      } else if (ctx.user.role === "ee") {
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "EE sem empresa associada." });
        contributorCompanyId = ctx.user.companyId;
        parentCompanyId = ctx.user.companyId;
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await database.execute(sql`SELECT id FROM kpi_submissions WHERE projectId = ${input.projectId} AND companyId = ${contributorCompanyId} AND weekNumber = ${input.weekNumber} AND weekYear = ${input.weekYear}`);
      let submissionId: number;
      if ((existing as any)[0]?.length > 0) {
        submissionId = (existing as any)[0][0].id;
        await database.execute(sql`DELETE FROM kpi_values WHERE submissionId = ${submissionId}`);
        await database.execute(sql`UPDATE kpi_submissions SET userId = ${ctx.user.id}, parentCompanyId = ${parentCompanyId}, sourceType = ${sourceType}, status = ${status}, updatedAt = NOW() WHERE id = ${submissionId}`);
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_submissions (projectId, companyId, parentCompanyId, sourceType, userId, weekNumber, weekYear, status) VALUES (${input.projectId}, ${contributorCompanyId}, ${parentCompanyId}, ${sourceType}, ${ctx.user.id}, ${input.weekNumber}, ${input.weekYear}, ${status})`);
        submissionId = (result as any)[0].insertId;
      }
      for (const value of input.values) {
        if (value.value && value.value.trim() !== "") {
          await database.execute(sql`INSERT INTO kpi_values (submissionId, metricId, value) VALUES (${submissionId}, ${value.metricId}, ${value.value})`);
        }
      }
      try {
        const { archiveDocument } = await import("./archive-provider");
        const project = await db.getProjectById(input.projectId);
        const company = await db.getCompanyById(contributorCompanyId);
        await archiveDocument("kpi", project?.code || "UNKNOWN", input.weekYear, {
          submissionId,
          projectId: input.projectId,
          companyId: contributorCompanyId,
          parentCompanyId,
          sourceType,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          values: input.values,
          userId: ctx.user.id,
        }, {
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          companyId: contributorCompanyId,
          companyName: company?.name || null,
        });
      } catch (error) {
        console.warn("KPI archive failed (non-fatal):", error);
      }
      return { success: true, submissionId, status, sourceType };
    }),
    upsertMetric: protectedProcedure.input(z.object({ id: z.number().optional(), name: z.string(), nameEn: z.string().optional(), unit: z.string(), target: z.string().optional(), category: z.string(), inputType: z.string().default("manual"), formulaType: z.string().optional(), formulaSourceMetricId: z.number().optional(), pci: z.string().optional(), emissionFactor: z.string().optional(), density: z.string().optional(), sortOrder: z.number().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.id) {
        await database.execute(sql`UPDATE kpi_metrics SET name=${input.name}, nameEn=${input.nameEn||null}, unit=${input.unit}, target=${input.target||null}, category=${input.category}, inputType=${input.inputType}, formulaType=${input.formulaType||null}, formulaSourceMetricId=${input.formulaSourceMetricId||null}, pci=${input.pci||null}, emissionFactor=${input.emissionFactor||null}, density=${input.density||null}, sortOrder=${input.sortOrder||0} WHERE id=${input.id}`);
        return { success: true, id: input.id };
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_metrics (name, nameEn, unit, target, category, inputType, formulaType, formulaSourceMetricId, pci, emissionFactor, density, sortOrder) VALUES (${input.name}, ${input.nameEn||null}, ${input.unit}, ${input.target||null}, ${input.category}, ${input.inputType}, ${input.formulaType||null}, ${input.formulaSourceMetricId||null}, ${input.pci||null}, ${input.emissionFactor||null}, ${input.density||null}, ${input.sortOrder||0})`);
        return { success: true, id: (result as any)[0].insertId };
      }
    }),
    deleteMetric: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.execute(sql`UPDATE kpi_metrics SET active = 0 WHERE id = ${input.id}`);
      return { success: true };
    }),
    // KPI Targets (Metas)
    targets: partnerAllowedProcedure.input(z.object({ projectId: z.number(), year: z.number().optional() })).query(async ({ ctx, input }) => {
      await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let q = sql`SELECT * FROM kpi_targets WHERE projectId = ${input.projectId}`;
      if (input.year) q = sql`${q} AND year = ${input.year}`;
      const rows = await database.execute(q);
      return (rows as any)[0] || [];
    }),
    upsertTarget: protectedProcedure.input(z.object({ id: z.number().optional(), metricId: z.number(), projectId: z.number(), targetType: z.string(), targetValue: z.string(), targetDirection: z.string(), year: z.number(), month: z.number().optional() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.id) {
        await database.execute(sql`UPDATE kpi_targets SET targetValue=${input.targetValue}, targetDirection=${input.targetDirection}, targetType=${input.targetType}, month=${input.month||null} WHERE id=${input.id}`);
        return { success: true, id: input.id };
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_targets (metricId, projectId, targetType, targetValue, targetDirection, year, month, createdBy) VALUES (${input.metricId}, ${input.projectId}, ${input.targetType}, ${input.targetValue}, ${input.targetDirection}, ${input.year}, ${input.month||null}, ${ctx.user.id})`);
        return { success: true, id: (result as any)[0].insertId };
      }
    }),
    deleteTarget: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await database.execute(sql`DELETE FROM kpi_targets WHERE id = ${input.id}`);
      return { success: true };
    }),
    // KPI Incidents
    listIncidents: partnerAllowedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role === "ee_partner" && !input.projectId) throw new TRPCError({ code: "FORBIDDEN" });
        if (input.projectId) await assertPartnerProjectModuleAccess(ctx.user, input.projectId, "kpi");
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        let query = database.select().from(schema.kpiIncidents);
        if (input.projectId) {
          query = query.where(eq(schema.kpiIncidents.projectId, input.projectId)) as any;
        }
        return await query;
      }),
    createIncident: protectedProcedure
      .input(z.object({ projectId: z.number(), name: z.string(), date: z.string(), status: z.string(), severity: z.string(), link: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.insert(schema.kpiIncidents).values({ ...input, createdBy: ctx.user.email });
        return { success: true };
      }),
    deleteIncident: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await database.delete(schema.kpiIncidents).where(eq(schema.kpiIncidents.id, input.id));
        return { success: true };
      }),
  }),

  // Audit log
  audit: {
    list: protectedProcedure.input(z.object({
      limit: z.number().optional().default(100),
      userId: z.number().optional(),
      action: z.string().optional(),
    })).query(async ({ ctx, input }) => {
      if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [sql`1=1`];
      if (input.userId) conditions.push(sql`userId = ${input.userId}`);
      if (input.action) conditions.push(sql`action = ${input.action}`);
      const rows = await database.execute(
        sql`SELECT * FROM audit_log WHERE ${sql.join(conditions, sql` AND `)} ORDER BY createdAt DESC LIMIT ${input.limit}`
      );
      return (rows as unknown) as any[];
    }),
  },

  // ─── Company Active Periods ──────────────────────────────────────────────
  companyPeriods: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return db.getProjectCompaniesWithPeriods(input.projectId);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        startWeek: z.number().int().min(1).max(53).nullable(),
        startYear: z.number().int().min(2020).max(2100).nullable(),
        endWeek: z.number().int().min(1).max(53).nullable(),
        endYear: z.number().int().min(2020).max(2100).nullable(),
        bufferWeeks: z.number().int().min(0).max(12).default(4),
      }).superRefine((period, validation) => {
        if ((period.startWeek === null) !== (period.startYear === null)) validation.addIssue({ code: "custom", message: "Indique a semana e o ano de início.", path: ["startWeek"] });
        if ((period.endWeek === null) !== (period.endYear === null)) validation.addIssue({ code: "custom", message: "Indique a semana e o ano de fim.", path: ["endWeek"] });
        if (period.startWeek !== null && period.startYear !== null && period.endWeek !== null && period.endYear !== null) {
          const start = period.startYear * 53 + period.startWeek;
          const end = period.endYear * 53 + period.endWeek;
          if (end < start) validation.addIssue({ code: "custom", message: "O fim dos trabalhos não pode ser anterior ao início.", path: ["endWeek"] });
        }
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const updated = await db.updateCompanyPeriod(input.id, input.startWeek, input.startYear, input.endWeek, input.endYear, input.bufferWeeks);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "A associação entre empresa e projecto já não existe." });
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "company_period_update", "project_companies", input.id, null, JSON.stringify({ startWeek: input.startWeek, startYear: input.startYear, endWeek: input.endWeek, endYear: input.endYear, bufferWeeks: input.bufferWeeks }));
        return { success: true };
      }),
  }),

  // ─── Weeks Without Work ──────────────────────────────────────────────────
  weeksWithoutWork: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getWeeksWithoutWork(input.projectId);
      }),
    add: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        weekNumber: z.number(),
        weekYear: z.number(),
        reason: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.addWeekWithoutWork(input.projectId, input.weekNumber, input.weekYear, input.reason, ctx.user.id);
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "week_without_work_add", "weeks_without_work", null, null, JSON.stringify({ projectId: input.projectId, weekNumber: input.weekNumber, weekYear: input.weekYear, reason: input.reason }));
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.removeWeekWithoutWork(input.id);
        await db.insertAuditLog(ctx.user.id, ctx.user.name || ctx.user.email, "week_without_work_remove", "weeks_without_work", input.id, null, null);
        return { success: true };
      }),
  }),

  // Notification recipients per project
  notificationRecipients: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        return db.listNotificationRecipientsByProject(input.projectId);
      }),
    add: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        userId: z.number(),
        notificationType: z.enum(["submission", "approval", "rejection", "all"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.addNotificationRecipient(input.projectId, input.userId, input.notificationType);
        return { success: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
        await db.removeNotificationRecipient(input.id);
        return { success: true };
      }),
  }),

  // In-app notification counts
  notifications: router({
    pending: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      const role = user.role || "user";
      const items: { type: string; count: number; label: string; path: string }[] = [];

      // Get all submissions
      const allSubs = await db.getAllSubmissions();

      if (role === "raa") {
        // Fichas waiting for review (submitted status)
        const toReview = allSubs.filter((s: any) => s.status === "submitted" || s.status === "under_review");
        // Filter by RAA's assigned projects
        const userProjects = await db.getUserProjects(user.id);
        const projectIds = userProjects.map((p: any) => p.projectId);
        const count = toReview.filter((s: any) => projectIds.includes(s.projectId)).length;
        if (count > 0) {
          items.push({ type: "review", count, label: `${count} ficha${count > 1 ? "s" : ""} para revisão`, path: "/ficha" });
        }
      }

      if (role === "ee" || role === "rap") {
        // Rejected fichas that need correction
        const rejected = allSubs.filter((s: any) =>
          s.status === "rejected" &&
          (s.createdBy === user.id || s.submittedBy === user.id)
        );
        if (rejected.length > 0) {
          items.push({ type: "rejected", count: rejected.length, label: `${rejected.length} ficha${rejected.length > 1 ? "s" : ""} rejeitada${rejected.length > 1 ? "s" : ""}`, path: "/ficha" });
        }
        // Draft fichas
        const drafts = allSubs.filter((s: any) =>
          s.status === "draft" &&
          s.createdBy === user.id
        );
        if (drafts.length > 0) {
          items.push({ type: "draft", count: drafts.length, label: `${drafts.length} rascunho${drafts.length > 1 ? "s" : ""}`, path: "/ficha" });
        }
      }

      if (role === "admin") {
        // Users pending approval
        const allUsers = await db.getAllUsers();
        const pendingUsers = allUsers.filter((u: any) => u.accountStatus === "pending");
        if (pendingUsers.length > 0) {
          items.push({ type: "users", count: pendingUsers.length, label: `${pendingUsers.length} utilizador${pendingUsers.length > 1 ? "es" : ""} pendente${pendingUsers.length > 1 ? "s" : ""}`, path: "/admin" });
        }
      }

      const totalCount = items.reduce((sum, i) => sum + i.count, 0);
      return { items, totalCount };
    }),
  }),
});

export type AppRouter = typeof appRouter;
