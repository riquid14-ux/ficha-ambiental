import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
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
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
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
      .input(z.object({ weekNumber: z.number(), weekYear: z.number(), weekStartDate: z.string(), weekEndDate: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!canSubmitForms(user.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar fichas." });
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
        const existing = await db.getSubmissionForWeek(user.companyId, input.weekNumber, input.weekYear);
        if (existing) return existing;

        // Create new
        const { id } = await db.createWeeklySubmission({
          companyId: user.companyId,
          weekNumber: input.weekNumber,
          weekYear: input.weekYear,
          weekStartDate: input.weekStartDate,
          weekEndDate: input.weekEndDate,
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
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Auto-fill NA for measures not relevant to this company type
        const company = await db.getCompanyById(sub.companyId);
        if (company) {
          const allMeasures = await db.getAllMeasures();
          const companyType = company.companyType.toUpperCase(); // "EE" or "RAP"
          const nonRelevant = allMeasures.filter((m) => !m.responsible.toUpperCase().includes(companyType));
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
        if (!isAdminOrDono(ctx.user.role) && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.resubmitSubmission(input.id, ctx.user.id);
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
        const fileKey = `historical/${input.companyId}/S${input.weekNumber}_${input.weekYear}_${input.filename}`;
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
});

export type AppRouter = typeof appRouter;
