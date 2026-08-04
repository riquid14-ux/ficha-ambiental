import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  companies,
  evidenceImages,
  InsertCompany,
  InsertEvidenceImage,
  InsertMeasureResponse,
  InsertUser,
  InsertWeeklySubmission,
  measureResponses,
  measures,
  sections,
  users,
  weeklySubmissions,
} from "../drizzle/schema";
import { historicalPdfs, InsertHistoricalPdf, InsertReviewComment, reviewComments } from "../drizzle/schema";
import { measureReviews, InsertMeasureReview } from "../drizzle/schema";
import { invitations, InsertInvitation } from "../drizzle/schema";
import { projects, projectCompanies, projectUsers, InsertProject, InsertProjectCompany, InsertProjectUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

const DO_EMAILS = [
  "rmd@startcampus.pt",
  "rom@startcampus.pt",
  "npa@startcampus.pt",
];

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  } else if (user.email && DO_EMAILS.includes(user.email.toLowerCase())) {
    values.role = "dono_obra";
    updateSet.role = "dono_obra";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });

  // ─── Auto-assign from pending invitation on first login ───────────────
  // Check if this user has a pending invitation by email and hasn't been
  // assigned a company yet. If so, apply the invited company + role.
  if (user.email) {
    const emailLower = user.email.toLowerCase();
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existingUser.length > 0) {
      const dbUser = existingUser[0];
      // Only auto-assign if user has no company yet (first login scenario)
      if (!dbUser.companyId || dbUser.role === "user") {
        const invitation = await getPendingInvitationByEmail(emailLower);
        if (invitation) {
          await db.update(users).set({
            companyId: invitation.companyId,
            role: invitation.role as any,
          }).where(eq(users.openId, user.openId));
          await acceptInvitation(invitation.id);
          console.log(`[Invitation] Auto-assigned user ${emailLower} to company ${invitation.companyId} with role ${invitation.role}`);
        }
      }
    }
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function updateUserCompany(userId: number, companyId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ companyId }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "ee" | "raa" | "rap" | "dono_obra" | "observador") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserProfile(userId: number, data: { fullName?: string | null; jobTitle?: string | null; name?: string | null }) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.fullName !== undefined) updateSet.fullName = data.fullName;
  if (data.jobTitle !== undefined) updateSet.jobTitle = data.jobTitle;
  if (data.name !== undefined) updateSet.name = data.name;
  if (Object.keys(updateSet).length > 0) {
    await db.update(users).set(updateSet).where(eq(users.id, userId));
  }
}

// ─── Companies ───────────────────────────────────────────────────────────────

export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies);
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(companies).values(data);
  return { id: result[0].insertId };
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(data).where(eq(companies.id, id));
}

// ─── Sections & Measures ─────────────────────────────────────────────────────

export async function getAllSections() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sections).orderBy(sections.orderIndex);
}

export async function getAllMeasures() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(measures).orderBy(measures.orderIndex);
}

export async function getMeasuresBySection(sectionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(measures).where(eq(measures.sectionId, sectionId)).orderBy(measures.orderIndex);
}

// ─── Weekly Submissions ──────────────────────────────────────────────────────

export async function createWeeklySubmission(data: InsertWeeklySubmission) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(weeklySubmissions).values(data);
  return { id: result[0].insertId };
}

export async function getSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(weeklySubmissions).where(eq(weeklySubmissions.id, id)).limit(1);
  return result[0];
}

export async function getSubmissionsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklySubmissions)
    .where(and(eq(weeklySubmissions.companyId, companyId), sql`${weeklySubmissions.status} != 'deleted'`))
    .orderBy(desc(weeklySubmissions.weekYear), desc(weeklySubmissions.weekNumber));
}

export async function getAllSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(weeklySubmissions)
    .where(sql`${weeklySubmissions.status} != 'deleted'`)
    .orderBy(desc(weeklySubmissions.weekYear), desc(weeklySubmissions.weekNumber));
}

export async function getLatestSubmissionForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(weeklySubmissions)
    .where(and(eq(weeklySubmissions.companyId, companyId), eq(weeklySubmissions.status, "submitted")))
    .orderBy(desc(weeklySubmissions.weekYear), desc(weeklySubmissions.weekNumber))
    .limit(1);
  return result[0];
}

export async function submitWeeklySubmission(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(weeklySubmissions)
    .set({ status: "submitted", submittedBy: userId, submittedAt: Date.now() })
    .where(eq(weeklySubmissions.id, id));
}

export async function getSubmissionForWeek(companyId: number, weekNumber: number, weekYear: number, projectId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(weeklySubmissions)
    .where(
      and(
        eq(weeklySubmissions.companyId, companyId),
        eq(weeklySubmissions.weekNumber, weekNumber),
        eq(weeklySubmissions.weekYear, weekYear),
        sql`${weeklySubmissions.status} != 'deleted'`,
        ...(projectId ? [eq(weeklySubmissions.projectId, projectId)] : [])
      )
    )
    .limit(1);
  return result[0];
}

export async function getDraftCountForCompany(companyId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select()
    .from(weeklySubmissions)
    .where(and(eq(weeklySubmissions.companyId, companyId), eq(weeklySubmissions.status, "draft")));
  return result.length;
}

export async function deleteWeeklySubmission(id: number) {
  const db = await getDb();
  if (!db) return;
  // Soft-delete: mark as deleted instead of removing data
  await db.update(weeklySubmissions).set({
    status: "deleted",
    deletedAt: Date.now(),
    deletedBy: id, // Will be overridden by caller
  }).where(eq(weeklySubmissions.id, id));
}

export async function softDeleteWeeklySubmission(id: number, deletedByUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(weeklySubmissions).set({
    status: "deleted",
    deletedAt: Date.now(),
    deletedBy: deletedByUserId,
  }).where(eq(weeklySubmissions.id, id));
}

export async function recoverWeeklySubmission(id: number) {
  const db = await getDb();
  if (!db) return;
  // Recover to draft status
  await db.update(weeklySubmissions).set({
    status: "draft",
    deletedAt: null,
    deletedBy: null,
  }).where(eq(weeklySubmissions.id, id));
}

export async function permanentlyDeleteWeeklySubmission(id: number) {
  const db = await getDb();
  if (!db) return;
  // Permanently delete - remove all related data (used for cleanup after 21 days)
  const responses = await db.select().from(measureResponses).where(eq(measureResponses.submissionId, id));
  if (responses.length > 0) {
    const responseIds = responses.map(r => r.id);
    await db.delete(evidenceImages).where(sql`${evidenceImages.responseId} IN (${sql.join(responseIds.map(rid => sql`${rid}`), sql`, `)})`);
    await db.delete(measureResponses).where(eq(measureResponses.submissionId, id));
  }
  await db.delete(measureReviews).where(eq(measureReviews.submissionId, id));
  await db.delete(reviewComments).where(eq(reviewComments.submissionId, id));
  await db.delete(weeklySubmissions).where(eq(weeklySubmissions.id, id));
}

export async function markDeletionLogRecovered(submissionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(deletionLogs).set({ recoveredAt: Date.now() }).where(eq(deletionLogs.submissionId, submissionId));
}

export async function reviewSubmission(id: number, userId: number, status: "approved" | "rejected", notes: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(weeklySubmissions).set({ status, reviewedBy: userId, reviewedAt: Date.now(), reviewNotes: notes }).where(eq(weeklySubmissions.id, id));
}

export async function resubmitSubmission(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(weeklySubmissions).set({ status: "submitted", submittedBy: userId, submittedAt: Date.now(), reviewedBy: null, reviewedAt: null, reviewNotes: null }).where(eq(weeklySubmissions.id, id));
}

// ─── Review Comments ────────────────────────────────────────────────────────

export async function addReviewComment(data: InsertReviewComment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reviewComments).values(data);
  return { id: result[0].insertId };
}

export async function getCommentsBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewComments).where(eq(reviewComments.submissionId, submissionId)).orderBy(desc(reviewComments.createdAt));
}

// ─── Measure Reviews (per-measure verdicts by RAA) ────────────────────────────

export async function getMeasureReviewsBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(measureReviews).where(eq(measureReviews.submissionId, submissionId));
}

export async function bulkUpsertMeasureReviews(submissionId: number, reviewerId: number, reviews: { measureId: number; verdict: "ok" | "nok"; comment: string | null }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (const r of reviews) {
    const existing = await db.select().from(measureReviews)
      .where(and(eq(measureReviews.submissionId, submissionId), eq(measureReviews.measureId, r.measureId)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(measureReviews)
        .set({ verdict: r.verdict, comment: r.comment, reviewerId })
        .where(eq(measureReviews.id, existing[0].id));
    } else {
      await db.insert(measureReviews).values({ submissionId, measureId: r.measureId, reviewerId, verdict: r.verdict, comment: r.comment });
    }
  }
}

// ─── Historical PDFs ────────────────────────────────────────────────────────

export async function addHistoricalPdf(data: InsertHistoricalPdf) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(historicalPdfs).values(data);
  return { id: result[0].insertId };
}

export async function getHistoricalPdfs(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    return db.select().from(historicalPdfs).where(eq(historicalPdfs.companyId, companyId)).orderBy(desc(historicalPdfs.weekYear), desc(historicalPdfs.weekNumber));
  }
  return db.select().from(historicalPdfs).orderBy(desc(historicalPdfs.weekYear), desc(historicalPdfs.weekNumber));
}

// ─── Measure Responses ───────────────────────────────────────────────────────

export async function getResponsesBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(measureResponses).where(eq(measureResponses.submissionId, submissionId));
}

export async function upsertMeasureResponse(data: InsertMeasureResponse) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Check if response already exists
  const existing = await db
    .select()
    .from(measureResponses)
    .where(
      and(
        eq(measureResponses.submissionId, data.submissionId),
        eq(measureResponses.measureId, data.measureId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(measureResponses)
      .set({ status: data.status, observations: data.observations })
      .where(eq(measureResponses.id, existing[0].id));
    return { id: existing[0].id };
  } else {
    const result = await db.insert(measureResponses).values(data);
    return { id: result[0].insertId };
  }
}

export async function bulkUpsertResponses(submissionId: number, responses: { measureId: number; status: "I" | "C" | "NC" | "NA" | null; observations: string | null }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  for (const r of responses) {
    await upsertMeasureResponse({
      submissionId,
      measureId: r.measureId,
      status: r.status,
      observations: r.observations,
    });
  }
}

// ─── Evidence Images ─────────────────────────────────────────────────────────

export async function addEvidenceImage(data: InsertEvidenceImage) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(evidenceImages).values(data);
  return { id: result[0].insertId };
}

export async function getImagesByResponse(responseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evidenceImages).where(eq(evidenceImages.responseId, responseId));
}

export async function getImagesBySubmission(submissionId: number) {
  const db = await getDb();
  if (!db) return [];
  const responses = await db.select().from(measureResponses).where(eq(measureResponses.submissionId, submissionId));
  if (responses.length === 0) return [];
  const responseIds = responses.map((r) => r.id);
  return db.select().from(evidenceImages).where(sql`${evidenceImages.responseId} IN (${sql.join(responseIds.map(id => sql`${id}`), sql`, `)})`);
}

export async function deleteEvidenceImage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(evidenceImages).where(eq(evidenceImages.id, id));
}

export async function getImageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(evidenceImages).where(eq(evidenceImages.id, id)).limit(1);
  return result[0];
}

export async function getResponseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(measureResponses).where(eq(measureResponses.id, id)).limit(1);
  return result[0];
}

// ─── Dashboard Analytics ─────────────────────────────────────────────────────

export async function getAnalytics(filters?: { companyId?: number; weekYear?: number; weekNumber?: number; sectionId?: number; projectId?: number }) {
  const db = await getDb();
  if (!db) return { total: 0, byStatus: {}, byWeek: [], bySection: [] };

  // Build conditions for submissions
  const subConditions = [];
  if (filters?.companyId) subConditions.push(eq(weeklySubmissions.companyId, filters.companyId));
  if (filters?.weekYear) subConditions.push(eq(weeklySubmissions.weekYear, filters.weekYear));
  if (filters?.weekNumber) subConditions.push(eq(weeklySubmissions.weekNumber, filters.weekNumber));
  if (filters?.projectId) subConditions.push(eq(weeklySubmissions.projectId, filters.projectId));

  // Always exclude soft-deleted submissions from analytics
  subConditions.push(sql`${weeklySubmissions.status} != 'deleted'`);

  const submissionsQuery = subConditions.length > 0
    ? db.select().from(weeklySubmissions).where(and(...subConditions))
    : db.select().from(weeklySubmissions);

  const subs = await submissionsQuery;
  if (subs.length === 0) return { total: 0, byStatus: { I: 0, C: 0, NC: 0, NA: 0 }, byWeek: [], bySection: [] };

  const subIds = subs.map((s) => s.id);

  // Get all responses for these submissions
  let allResponses = await db.select().from(measureResponses).where(
    sql`${measureResponses.submissionId} IN (${sql.join(subIds.map(id => sql`${id}`), sql`, `)})`
  );

  // Filter by section if needed
  if (filters?.sectionId) {
    const sectionMeasures = await db.select().from(measures).where(eq(measures.sectionId, filters.sectionId));
    const measureIds = new Set(sectionMeasures.map((m) => m.id));
    allResponses = allResponses.filter((r) => measureIds.has(r.measureId));
  }

  // Count by status
  const byStatus = { I: 0, C: 0, NC: 0, NA: 0 };
  for (const r of allResponses) {
    if (r.status && r.status in byStatus) {
      byStatus[r.status as keyof typeof byStatus]++;
    }
  }

  // Group by week
  const weekMap = new Map<string, { I: number; C: number; NC: number; NA: number; total: number }>();
  for (const sub of subs) {
    const key = `${sub.weekYear}-W${String(sub.weekNumber).padStart(2, "0")}`;
    if (!weekMap.has(key)) weekMap.set(key, { I: 0, C: 0, NC: 0, NA: 0, total: 0 });
  }
  for (const r of allResponses) {
    const sub = subs.find((s) => s.id === r.submissionId);
    if (!sub) continue;
    const key = `${sub.weekYear}-W${String(sub.weekNumber).padStart(2, "0")}`;
    const entry = weekMap.get(key)!;
    if (r.status && r.status in entry) {
      entry[r.status as keyof typeof byStatus]++;
    }
    entry.total++;
  }

  const byWeek = Array.from(weekMap.entries())
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Group by section
  const allMeasuresList = await db.select().from(measures);
  const sectionMap = new Map<number, { I: number; C: number; NC: number; NA: number }>();
  for (const r of allResponses) {
    const measure = allMeasuresList.find((m) => m.id === r.measureId);
    if (!measure) continue;
    if (!sectionMap.has(measure.sectionId)) sectionMap.set(measure.sectionId, { I: 0, C: 0, NC: 0, NA: 0 });
    const entry = sectionMap.get(measure.sectionId)!;
    if (r.status && r.status in entry) {
      entry[r.status as keyof typeof byStatus]++;
    }
  }

  const allSections = await db.select().from(sections).orderBy(sections.orderIndex);
  const bySection = allSections.map((s) => ({
    sectionId: s.id,
    sectionName: s.name,
    ...(sectionMap.get(s.id) || { I: 0, C: 0, NC: 0, NA: 0 }),
  }));

  // Group by company
  const companyMap2 = new Map<number, { I: number; C: number; NC: number; NA: number; total: number }>();
  for (const sub of subs) {
    if (!companyMap2.has(sub.companyId)) companyMap2.set(sub.companyId, { I: 0, C: 0, NC: 0, NA: 0, total: 0 });
  }
  for (const r of allResponses) {
    const sub2 = subs.find((s) => s.id === r.submissionId);
    if (!sub2) continue;
    const entry2 = companyMap2.get(sub2.companyId)!;
    if (r.status && r.status in entry2) { (entry2 as any)[r.status]++; }
    entry2.total++;
  }
  const allCompaniesList = await db.select().from(companies);
  const byCompany = Array.from(companyMap2.entries()).map(([cId, data]) => ({
    companyId: cId,
    companyName: allCompaniesList.find((c) => c.id === cId)?.shortName || "Desconhecida",
    ...data,
  }));

  return { total: allResponses.length, byStatus, byWeek, bySection, byCompany };
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(invitations).values(data);
  return result;
}

export async function getInvitationsByStatus(status: "pending" | "accepted" | "expired") {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).where(eq(invitations.status, status));
}

export async function getAllInvitations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).orderBy(sql`${invitations.createdAt} DESC`);
}

export async function getPendingInvitationByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const normalizedEmail = email.toLowerCase().trim();
  const results = await db.select().from(invitations)
    .where(and(eq(invitations.email, normalizedEmail), eq(invitations.status, "pending")));
  return results[0] || null;
}

export async function acceptInvitation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(invitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(invitations.id, id));
}

export async function deleteInvitation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(invitations).where(eq(invitations.id, id));
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(projects.code);
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data);
  return { id: result[0].insertId };
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data).where(eq(projects.id, id));
}

// ─── Project-Company Associations ───────────────────────────────────────────

export async function getProjectCompanies(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectCompanies).where(eq(projectCompanies.projectId, projectId));
}

export async function getProjectsForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectCompanies).where(eq(projectCompanies.companyId, companyId));
}

export async function addCompanyToProject(projectId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if already exists
  const existing = await db.select().from(projectCompanies)
    .where(and(eq(projectCompanies.projectId, projectId), eq(projectCompanies.companyId, companyId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(projectCompanies).values({ projectId, companyId });
}

export async function removeCompanyFromProject(projectId: number, companyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectCompanies).where(and(eq(projectCompanies.projectId, projectId), eq(projectCompanies.companyId, companyId)));
}

// ─── Project-User Associations ──────────────────────────────────────────────

export async function getProjectUsers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectUsers).where(eq(projectUsers.projectId, projectId));
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectUsers).where(eq(projectUsers.userId, userId));
}

export async function addUserToProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db.select().from(projectUsers)
    .where(and(eq(projectUsers.projectId, projectId), eq(projectUsers.userId, userId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(projectUsers).values({ projectId, userId });
}

export async function removeUserFromProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projectUsers).where(and(eq(projectUsers.projectId, projectId), eq(projectUsers.userId, userId)));
}

export async function getAllUserProjectAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectUsers);
}

export async function getAllCompanyProjectAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectCompanies);
}

export async function setCompanyProjects(companyId: number, projectIds: number[]) {
  const db = await getDb();
  if (!db) return;
  // Remove all existing assignments for this company
  await db.delete(projectCompanies).where(eq(projectCompanies.companyId, companyId));
  // Add new assignments
  if (projectIds.length > 0) {
    await db.insert(projectCompanies).values(projectIds.map(projectId => ({ projectId, companyId })));
  }
}

export async function setUserProjects(userId: number, projectIds: number[]) {
  const db = await getDb();
  if (!db) return;
  // Remove all existing assignments for this user
  await db.delete(projectUsers).where(eq(projectUsers.userId, userId));
  // Add new assignments
  if (projectIds.length > 0) {
    await db.insert(projectUsers).values(projectIds.map(projectId => ({ projectId, userId })));
  }
}

// ─── Deletion Logs ────────────────────────────────────────────────────────────
export async function createDeletionLog(data: {
  submissionId: number;
  projectId?: number | null;
  weekNumber: number;
  weekYear: number;
  companyId: number | null;
  companyName: string | null;
  createdBy?: number | null;
  deletedBy: number;
  deletedByName: string | null;
  deletedByEmail: string | null;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(deletionLogs).values(data as any);
}

export async function getDeletionLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deletionLogs).where(sql`${deletionLogs.recoveredAt} IS NULL`).orderBy(sql`${deletionLogs.deletedAt} DESC`);
}

// ─── Project-scoped queries ─────────────────────────────────────────────────

export async function getSubmissionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklySubmissions)
    .where(and(eq(weeklySubmissions.projectId, projectId), sql`${weeklySubmissions.status} != 'deleted'`))
    .orderBy(desc(weeklySubmissions.weekYear), desc(weeklySubmissions.weekNumber));
}

export async function getHistoricalPdfsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicalPdfs)
    .where(eq(historicalPdfs.projectId, projectId))
    .orderBy(desc(historicalPdfs.weekYear), desc(historicalPdfs.weekNumber));
}

export async function getCompaniesForProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const associations = await db.select().from(projectCompanies).where(eq(projectCompanies.projectId, projectId));
  if (associations.length === 0) return [];
  const companyIds = associations.map(a => a.companyId);
  return db.select().from(companies).where(sql`${companies.id} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})`);
}
import { deletionLogs } from "../drizzle/schema";
