import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sql } from "drizzle-orm";
import { storagePut } from "./storage";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";

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
        const buffer = Buffer.from(input.data, "base64");
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
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) return null;
        const rows = await database.execute(sql`SELECT value FROM app_settings WHERE \`key\` = ${input.key}`);
        return (rows as any)?.[0]?.[0]?.value || null;
      }),
    getAll: publicProcedure
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
    me: publicProcedure.query((opts) => opts.ctx.user),
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
          throw new TRPCError({ code: "FORBIDDEN", message: "A sua conta está pendente de aprovação. Contacte Nairana Aguiar npa@startcampus.pt" });
        }
        if ((user as any).accountStatus === "rejected") {
          throw new TRPCError({ code: "FORBIDDEN", message: "O seu pedido de acesso foi rejeitado. Contacte Nairana Aguiar npa@startcampus.pt" });
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
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, requires2FA: false, userId: user.id, mustChangePassword: !!(user as any).mustChangePassword };
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
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
        return { success: true, mustChangePassword: !!(user as any).mustChangePassword };
      }),

    // ─── Register (creates pending account) ─────────────────────────────────
    register: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(6), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        if (existingUsers.find((u) => u.email?.toLowerCase().trim() === email)) {
          throw new TRPCError({ code: "CONFLICT", message: "Este email já está registado." });
        }
        const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
        const passwordHash = await bcrypt.hash(input.password, 10);
        await db.upsertUser({ openId, name: input.name, email, loginMethod: "email", role: "user" });
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET passwordHash = ${passwordHash}, mustChangePassword = 0, accountStatus = 'pending' WHERE openId = ${openId}`);
        }
        return { success: true, message: "Conta criada com sucesso. Aguarde aprovação do administrador." };
      }),

    // ─── Change password ────────────────────────────────────────────────────
    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }))
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

    // ─── Admin: approve/reject pending accounts ─────────────────────────────
    approveAccount: protectedProcedure
      .input(z.object({ userId: z.number(), approve: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const status = input.approve ? "active" : "rejected";
        const database = await db.getDb();
        if (database) {
          await database.execute(sql`UPDATE users SET accountStatus = ${status} WHERE id = ${input.userId}`);
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

    // ─── Legacy emailLogin (for ACC iframe auto-login) ──────────────────────
    emailLogin: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        const existingUsers = await db.getAllUsers();
        const existingUser = existingUsers.find((u) => u.email?.toLowerCase().trim() === email);
        if (existingUser && (existingUser as any).accountStatus === "active") {
          const sessionToken = await sdk.createSessionToken(existingUser.openId, { name: existingUser.name || email });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
          return { success: true, user: existingUser };
        }
        throw new TRPCError({ code: "FORBIDDEN", message: "Não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt" });
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
          // Only the super-admin (riquid14) can demote other admins
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
        return { success: true };
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
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (!isAdminOrDono(ctx.user.role) && ctx.user.role !== "raa" && ctx.user.role !== "observador") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (input?.companyId) {
          return db.getSubmissionsByCompany(input.companyId);
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
        // Only draft or rejected can be deleted
        if (sub.status !== "draft" && sub.status !== "rejected") {
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
        if (sub.status !== "submitted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só fichas submetidas podem ser revistas." });
        }
        // Save per-measure reviews if provided
        if (input.measureReviews && input.measureReviews.length > 0) {
          await db.bulkUpsertMeasureReviews(input.id, ctx.user.id, input.measureReviews);
        }
        await db.reviewSubmission(input.id, ctx.user.id, input.status, input.notes);
        return { success: true };
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

        const buffer = Buffer.from(input.data, "base64");
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
      // Admin/dono_obra see all projects; others see only assigned projects
      if (isAdminOrDono(ctx.user.role)) {
        return allProjects;
      }
      // Check user-level project assignments first
      const userProjectAssocs = await db.getUserProjects(ctx.user.id);
      const userProjectIds = new Set(userProjectAssocs.map(up => up.projectId));
      // Also check company-level project assignments
      if (ctx.user.companyId) {
        const companyProjectAssocs = await db.getProjectsForCompany(ctx.user.companyId);
        for (const cp of companyProjectAssocs) {
          userProjectIds.add(cp.projectId);
        }
      }
      // If no specific assignments at all (neither user nor company), show all projects
      if (userProjectIds.size === 0) {
        return allProjects;
      }
      // Otherwise, filter to only assigned projects
      return allProjects.filter(p => userProjectIds.has(p.id));
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
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        // All authenticated users can view the matrix
        return db.getMatrixData(input?.projectId);
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
        const buffer = Buffer.from(input.data, "base64");
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
        await db.pool.query("UPDATE project_phases SET startDate = ?, endDate = ?, hidden = COALESCE(?, hidden), progress = COALESCE(?, progress) WHERE id = ?", [data.startDate || null, data.endDate || null, data.hidden ?? null, data.progress ?? null, id]);
        return { success: true };
      }),
  }),

  phaseMeasures: router({
    getAllProjectsProgress: protectedProcedure
      .query(async () => {
        // Get all projects
        const allProjects = await db.getAllProjects();
        // Get all phase measure statuses for all projects
        const results: { projectId: number; code: string; phases: { key: string; total: number; concluido: number; progress: number }[] }[] = [];
        const allSections = await db.getAllSections();
        const allMeasures = await db.getAllMeasures();

        for (const proj of allProjects) {
          const statuses = await db.getPhaseMeasureStatuses(proj.id);
          const statusMap = new Map<number, string>();
          statuses.forEach((s: any) => statusMap.set(s.measureId, s.status));

          const phases: { key: string; total: number; concluido: number; progress: number }[] = [];
          const PHASE_KEYS = ["Prévias Licenciamento", "Em Sede de Licenciamento", "Pré-Construção", "Preparação Prévia", "Execução da Obra", "Fase Final", "Fase Final Construção", "Exploração", "Desativação (Pós-Exploração)"];

          for (const phaseKey of PHASE_KEYS) {
            const phaseSections = allSections.filter((s: any) => s.phase === phaseKey);
            const sectionIds = new Set(phaseSections.map((s: any) => s.id));
            const phaseMeasures = allMeasures.filter((m: any) => sectionIds.has(m.sectionId));
            const total = phaseMeasures.length;
            if (total === 0) continue;
            const concluido = phaseMeasures.filter((m: any) => statusMap.get(m.id) === "concluido").length;
            phases.push({ key: phaseKey, total, concluido, progress: Math.round((concluido / total) * 100) });
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
  }),
});

export type AppRouter = typeof appRouter;
