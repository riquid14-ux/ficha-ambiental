import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql, eq } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { storagePut } from "./storage";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { sendFichaSubmittedNotification, sendFichaReviewedNotification, sendInvitationEmail } from "./email";
import { sanitizeFile } from "./file-sanitizer";

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

// Helper: check if user can submit forms (ee or rap)
function canSubmitForms(role: string) {
  return role === "ee" || role === "rap" || role === "admin" || role === "dono_obra";
}

// Helper: check if user can review forms (raa, admin, dono_obra)
function canReview(role: string) {
  return role === "raa" || role === "admin" || role === "dono_obra";
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
    changePassword: protectedProcedure
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
    setup2FA: protectedProcedure.mutation(async ({ ctx }) => {
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
    confirm2FA: protectedProcedure
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
    disable2FA: protectedProcedure.mutation(async ({ ctx }) => {
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
      return db.getAllCompanies();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCompanyById(input.id);
      }),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1), shortName: z.string().min(1), companyType: z.enum(["ee", "rap", "dono_obra", "raa", "observador"]).default("ee") }))
      .mutation(async ({ input }) => {
        return db.createCompany({ name: input.name, shortName: input.shortName, companyType: input.companyType });
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), shortName: z.string().optional(), active: z.number().optional(), companyType: z.enum(["ee", "rap", "dono_obra", "raa", "observador"]).optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCompany(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET companyId = NULL WHERE companyId = ${input.id}`);
          await database.execute(sql`DELETE FROM company_projects WHERE companyId = ${input.id}`);
          await database.execute(sql`DELETE FROM companies WHERE id = ${input.id}`);
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
              rap: "rap",
              dono_obra: "dono_obra",
              raa: "raa",
              observador: "observador",
            };
            const newRole = (roleMap[company.companyType] || "user") as "user" | "admin" | "ee" | "raa" | "rap" | "dono_obra" | "observador";
            await db.updateUserRole(input.userId, newRole);
          }
        }
        return { success: true };
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "ee", "raa", "rap", "dono_obra", "observador"]) }))
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
        role: z.enum(["user", "admin", "ee", "raa", "rap", "dono_obra", "observador"]),
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
            user: "Utilizador", admin: "Administrador", ee: "Entidade Executante",
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
    // ─── Import PDF Historical Ficha ────────────────────────────────────
    importPdf: protectedProcedure
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
    list: protectedProcedure.query(async ({ ctx }) => {
      const allProjects = await db.getAllProjects();
      const role = ctx.user.role;
      // Admin/dono_obra/PM see all projects
      if (role === "admin" || role === "dono_obra" || role === "pm") {
        return allProjects;
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
      .query(async ({ input }) => {
        return db.getProjectById(input.id);
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
      .query(async ({ input }) => {
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
      .query(async ({ input }) => {
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
      .input(z.object({ companyId: z.number(), projectIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
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
      .query(async ({ ctx, input }) => {
        return await db.getMonitoringPlans(input?.projectId);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
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
          projectId: input.projectId ?? null,
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
        name: z.string().optional(),
        periodicity: z.string().optional(),
        lastReportingDate: z.number().optional(),
        nextReportingDate: z.number().optional(),
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

    submitDocument: protectedProcedure
      .input(z.object({
        id: z.number(),
        fileUrl: z.string(),
        fileKey: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem submeter documentos" });
        }
        await db.updateMonitoringPlan(input.id, {
          submissionStatus: "submitted",
          submittedFileUrl: input.fileUrl,
          submittedFileKey: input.fileKey,
          submittedAt: Date.now(),
        } as any);
        return { success: true };
      }),

    confirmDelivery: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra podem confirmar entregas" });
        }
        // Get current plan to calculate next date
        const plans = await db.getMonitoringPlans();
        const plan = plans.find(p => p.id === input.id);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND" });

        const now = Date.now();
        // Calculate next reporting date based on periodicity
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

        await db.updateMonitoringPlan(input.id, {
          submissionStatus: "delivered",
          confirmedDeliveryAt: now,
          lastReportingDate: now,
          nextReportingDate: nextDate,
        } as any);
        return { success: true, nextReportingDate: nextDate };
      }),
  }),

  // ─── Project Phases ─────────────────────────────────────────────────────────
  projectPhases: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getProjectPhases(input.projectId);
      }),

    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getAllProjectPhases();
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
          statuses.forEach((s: any) => statusMap.set(s.measureId, s.status));

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
      .query(async ({ input }) => {
        return await db.getPhaseMeasureStatuses(input.projectId);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        measureId: z.number(),
        projectId: z.number(),
        status: z.enum(["pendente", "em_curso", "concluido"]),
        notes: z.string().nullable().default(null),
      }))
      .mutation(async ({ ctx, input }) => {
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
        await db.updateCalendarEvent(input.id, { ownerId: input.ownerId, ownerName: input.ownerName });
        return { success: true };
      }),
  }),

  wasteEgars: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number(), year: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getWasteEgars(input.projectId, input.year);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        date: z.number(),
        egarId: z.string().optional(),
        egarLink: z.string().optional(),
        operator: z.string().optional(),
        lerCode: z.string().min(1),
        designation: z.string().min(1),
        quantity: z.string().min(1),
        destination: z.enum(["recycled", "incinerated", "landfill"]).optional(),
        month: z.number(),
        year: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas Admin ou Dono de Obra" });
        }
        const result = await db.createWasteEgar({
          ...input,
          egarId: input.egarId ?? null,
          egarLink: input.egarLink ?? null,
          operator: input.operator ?? null,
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
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteWasteEgar(input.id);
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
    metrics: protectedProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`SELECT * FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder ASC`);
      return (rows as any)[0] || [];
    }),
    matrix: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`SELECT ks.id, ks.companyId, ks.weekNumber, ks.weekYear, ks.status, ks.createdAt, c.name as companyName, c.shortName FROM kpi_submissions ks JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId} ORDER BY ks.weekYear DESC, ks.weekNumber DESC`);
      return (rows as any)[0] || [];
    }),
    values: protectedProcedure.input(z.object({ submissionId: z.number() })).query(async ({ input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await database.execute(sql`SELECT * FROM kpi_values WHERE submissionId = ${input.submissionId}`);
      return (rows as any)[0] || [];
    }),
    allValues: protectedProcedure.input(z.object({ projectId: z.number(), weekYear: z.number().optional(), weekNumber: z.number().optional() })).query(async ({ input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      let q = sql`SELECT kv.metricId, kv.value, ks.weekNumber, ks.weekYear, ks.companyId, c.shortName as companyName FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId JOIN companies c ON c.id = ks.companyId WHERE ks.projectId = ${input.projectId}`;
      if (input.weekYear) q = sql`${q} AND ks.weekYear = ${input.weekYear}`;
      if (input.weekNumber) q = sql`${q} AND ks.weekNumber = ${input.weekNumber}`;
      const rows = await database.execute(q);
      return (rows as any)[0] || [];
    }),
    submit: protectedProcedure.input(z.object({ projectId: z.number(), companyId: z.number(), weekNumber: z.number(), weekYear: z.number(), values: z.array(z.object({ metricId: z.number(), value: z.string() })) })).mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const existing = await database.execute(sql`SELECT id FROM kpi_submissions WHERE projectId = ${input.projectId} AND companyId = ${input.companyId} AND weekNumber = ${input.weekNumber} AND weekYear = ${input.weekYear}`);
      let submissionId: number;
      if ((existing as any)[0]?.length > 0) {
        submissionId = (existing as any)[0][0].id;
        await database.execute(sql`DELETE FROM kpi_values WHERE submissionId = ${submissionId}`);
        await database.execute(sql`UPDATE kpi_submissions SET userId = ${ctx.user.id}, updatedAt = NOW() WHERE id = ${submissionId}`);
      } else {
        const result = await database.execute(sql`INSERT INTO kpi_submissions (projectId, companyId, userId, weekNumber, weekYear) VALUES (${input.projectId}, ${input.companyId}, ${ctx.user.id}, ${input.weekNumber}, ${input.weekYear})`);
        submissionId = (result as any)[0].insertId;
      }
      for (const v of input.values) {
        if (v.value && v.value.trim() !== "") {
          await database.execute(sql`INSERT INTO kpi_values (submissionId, metricId, value) VALUES (${submissionId}, ${v.metricId}, ${v.value})`);
        }
      }
      // Archive KPI submission to external storage
      try {
        const { archiveDocument } = await import("./archive-provider");
        const project = await db.getProjectById(input.projectId);
        const company = await db.getCompanyById(input.companyId);
        await archiveDocument("kpi", project?.code || "UNKNOWN", input.weekYear, {
          submissionId,
          projectId: input.projectId,
          companyId: input.companyId,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          values: input.values,
          userId: ctx.user.id,
        }, {
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          companyId: input.companyId,
          companyName: company?.name || null,
        });
      } catch (e) {
        console.warn("KPI archive failed (non-fatal):", e);
      }
      return { success: true, submissionId };
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
    targets: protectedProcedure.input(z.object({ projectId: z.number(), year: z.number().optional() })).query(async ({ input }) => {
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
    listIncidents: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }))
      .query(async ({ input }) => {
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
      .mutation(async ({ input }) => {
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
        return db.getProjectCompaniesWithPeriods(input.projectId);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        startWeek: z.number().nullable(),
        startYear: z.number().nullable(),
        endWeek: z.number().nullable(),
        endYear: z.number().nullable(),
        bufferWeeks: z.number().default(4),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateCompanyPeriod(input.id, input.startWeek, input.startYear, input.endWeek, input.endYear, input.bufferWeeks);
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
        // Pending access requests
        const accessRequests = await db.getAccessRequests();
        const pending = (accessRequests as any[]).filter((r: any) => r.status === "pending");
        if (pending.length > 0) {
          items.push({ type: "access", count: pending.length, label: `${pending.length} pedido${pending.length > 1 ? "s" : ""} de acesso`, path: "/admin" });
        }

        // Users pending approval
        const allUsers = await db.getAllUsers();
        const pendingUsers = allUsers.filter((u: any) => u.status === "pending");
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
