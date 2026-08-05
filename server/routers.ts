import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

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

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    emailLogin: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();

        // 1. Check if user already exists with this email
        const existingUsers = await db.getAllUsers();
        const existingUser = existingUsers.find(
          (u) => u.email?.toLowerCase().trim() === email
        );

        if (existingUser) {
          // User exists — create session directly
          const sessionToken = await sdk.createSessionToken(existingUser.openId, {
            name: existingUser.name || email,
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
          });
          return { success: true, user: existingUser };
        }

        // 2. Check if there's a pending invitation for this email
        const invitation = await db.getPendingInvitationByEmail(email);

        if (invitation) {
          // Create user from invitation
          const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
          await db.upsertUser({
            openId,
            name: email.split("@")[0],
            email,
            loginMethod: "email",
            role: invitation.role as any,
          });

          // Assign company from invitation
          const newUser = await db.getUserByOpenId(openId);
          if (newUser && invitation.companyId) {
            await db.updateUserCompany(newUser.id, invitation.companyId);
          }
          await db.acceptInvitation(invitation.id);

          // Create session
          const sessionToken = await sdk.createSessionToken(openId, {
            name: email.split("@")[0],
          });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: 365 * 24 * 60 * 60 * 1000,
          });

          const finalUser = await db.getUserByOpenId(openId);
          return { success: true, user: finalUser };
        }

        // 3. No user and no invitation — deny access
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt",
        });
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
        // Prevent demoting an admin unless the requester is the hidden super-admin (riquid14@gmail.com)
        const targetUser = await db.getUserById(input.userId);
        if (targetUser?.role === "admin" && input.role !== "admin") {
          if (ctx.user.email !== "riquid14@gmail.com") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível remover o papel de Admin a outro administrador." });
          }
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
});

export type AppRouter = typeof appRouter;
