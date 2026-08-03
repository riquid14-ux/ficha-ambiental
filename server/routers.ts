import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

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
      .input(z.object({ name: z.string().min(1), shortName: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return db.createCompany({ name: input.name, shortName: input.shortName });
      }),
    update: adminProcedure
      .input(z.object({ id: z.number(), name: z.string().optional(), shortName: z.string().optional(), active: z.number().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCompany(id, data);
        return { success: true };
      }),
  }),

  // ─── Users Management (Admin) ─────────────────────────────────────────────
  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    assignCompany: adminProcedure
      .input(z.object({ userId: z.number(), companyId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        await db.updateUserCompany(input.userId, input.companyId);
        return { success: true };
      }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
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
        if (!user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Utilizador não está associado a nenhuma empresa." });
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

        // Non-admin can only see own company submissions
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return sub;
      }),

    // List submissions for current user's company
    mySubmissions: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return db.getSubmissionsByCompany(ctx.user.companyId);
    }),

    // Admin: list all submissions
    listAll: adminProcedure
      .input(z.object({ companyId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.companyId) {
          return db.getSubmissionsByCompany(input.companyId);
        }
        return db.getAllSubmissions();
      }),

    // Submit (finalize)
    submit: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.id);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.submitWeeklySubmission(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Measure Responses ─────────────────────────────────────────────────────
  responses: router({
    getBySubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const sub = await db.getSubmissionById(input.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
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
        if (sub.status === "submitted" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ficha já submetida." });
        }
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
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
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getImagesBySubmission(input.submissionId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Verify ownership: get the image, find its response, find its submission
        const images = await db.getImagesByResponse(0); // We need to get the specific image
        // Actually, let's get the image directly and verify access
        const allImages = await db.getImageById(input.id);
        if (!allImages) throw new TRPCError({ code: "NOT_FOUND" });
        // Check if user has access to the submission this image belongs to
        const response = await db.getResponseById(allImages.responseId);
        if (!response) throw new TRPCError({ code: "NOT_FOUND" });
        const sub = await db.getSubmissionById(response.submissionId);
        if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && sub.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await db.deleteEvidenceImage(input.id);
        return { success: true };
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
        // Non-admin can only see own company
        const filters = { ...input };
        if (ctx.user.role !== "admin" && ctx.user.companyId) {
          filters.companyId = ctx.user.companyId;
        }
        return db.getAnalytics(filters);
      }),
  }),
});

export type AppRouter = typeof appRouter;
