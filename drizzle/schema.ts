import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, serial, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]).default("user").notNull(),
  companyId: int("companyId"),
  fullName: varchar("fullName", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: int("mustChangePassword").default(1),
  totpSecret: varchar("totpSecret", { length: 255 }),
  totpEnabled: int("totpEnabled").default(0),
  twoFactorGraceUntil: timestamp("twoFactorGraceUntil"),
  accountStatus: varchar("accountStatus", { length: 20 }).default("active"),
  passwordResetToken: varchar("passwordResetToken", { length: 255 }),
  passwordResetExpiry: bigint("passwordResetExpiry", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Companies (Empresas Executantes - EE / RAP)
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 50 }).notNull(),
  companyType: mysqlEnum("companyType", ["ee", "ee_partner", "rap", "dono_obra", "raa", "pm", "observador"]).default("ee").notNull(),
  logoUrl: text("logoUrl"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * EE partner access is configured per user. The parent EE defines the hard
 * project boundary; project_users may only grant a subset of that boundary.
 */
export const partnerAccessProfiles = mysqlTable("partner_access_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  parentCompanyId: int("parentCompanyId").notNull(),
  allowKpi: boolean("allowKpi").default(false).notNull(),
  allowWaste: boolean("allowWaste").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  configuredBy: int("configuredBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex("partner_access_profiles_user_unique").on(table.userId),
  parentCompanyIdx: index("partner_access_profiles_parent_company_idx").on(table.parentCompanyId),
}));

export type PartnerAccessProfile = typeof partnerAccessProfiles.$inferSelect;
export type InsertPartnerAccessProfile = typeof partnerAccessProfiles.$inferInsert;

export const partnerCompanyProfiles = mysqlTable("partner_company_profiles", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  parentCompanyId: int("parentCompanyId").notNull(),
  allowKpi: boolean("allowKpi").default(false).notNull(),
  allowWaste: boolean("allowWaste").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  configuredBy: int("configuredBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyUnique: uniqueIndex("partner_company_profiles_company_unique").on(table.companyId),
  parentCompanyIdx: index("partner_company_profiles_parent_idx").on(table.parentCompanyId),
}));

export type PartnerCompanyProfile = typeof partnerCompanyProfiles.$inferSelect;
export type InsertPartnerCompanyProfile = typeof partnerCompanyProfiles.$inferInsert;

/**
 * Pedidos submetidos por uma EE para criação de uma EEP. A empresa, os
 * projectos e os módulos só são materializados depois de aprovação Admin.
 */
export const eepRequests = mysqlTable("eep_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestedByUserId: int("requestedByUserId").notNull(),
  parentCompanyId: int("parentCompanyId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 50 }).notNull(),
  allowKpi: boolean("allowKpi").default(false).notNull(),
  allowWaste: boolean("allowWaste").default(false).notNull(),
  projectIdsJson: text("projectIdsJson").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  reviewNotes: text("reviewNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdCompanyId: int("createdCompanyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  parentCompanyIdx: index("eep_requests_parent_company_idx").on(table.parentCompanyId),
  requesterIdx: index("eep_requests_requester_idx").on(table.requestedByUserId),
  statusIdx: index("eep_requests_status_idx").on(table.status),
}));

export const eepRequestUsers = mysqlTable("eep_request_users", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  requestIdx: index("eep_request_users_request_idx").on(table.requestId),
  requestEmailUnique: uniqueIndex("eep_request_users_request_email_unique").on(table.requestId, table.email),
}));

export type EepRequest = typeof eepRequests.$inferSelect;
export type InsertEepRequest = typeof eepRequests.$inferInsert;
export type EepRequestUser = typeof eepRequestUsers.$inferSelect;
export type InsertEepRequestUser = typeof eepRequestUsers.$inferInsert;

/**
 * Sections (14 secções do documento)
 */
export const sections = mysqlTable("sections", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  orderIndex: int("orderIndex").notNull(),
  phase: varchar("phase", { length: 100 }).notNull(),
});

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

/**
 * Measures (156 medidas de minimização)
 */
export const measures = mysqlTable("measures", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 20 }).notNull(),
  description: text("description").notNull(),
  responsible: varchar("responsible", { length: 50 }).notNull(),
  sectionId: int("sectionId").notNull(),
  orderIndex: int("orderIndex").notNull(),
});

export type Measure = typeof measures.$inferSelect;
export type InsertMeasure = typeof measures.$inferInsert;

/**
 * Weekly Submissions (ficha semanal por empresa)
 */
export const weeklySubmissions = mysqlTable("weekly_submissions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  projectId: int("projectId"),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  weekStartDate: varchar("weekStartDate", { length: 10 }).notNull(),
  weekEndDate: varchar("weekEndDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "under_review", "approved", "rejected", "deleted"]).default("draft").notNull(),
  submittedBy: int("submittedBy"),
  createdBy: int("createdBy"),
  submittedAt: bigint("submittedAt", { mode: "number" }),
  reviewedBy: int("reviewedBy"),
  reviewedAt: bigint("reviewedAt", { mode: "number" }),
  reviewNotes: text("reviewNotes"),
  deletedAt: bigint("deletedAt", { mode: "number" }),
  deletedBy: int("deletedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklySubmission = typeof weeklySubmissions.$inferSelect;
export type InsertWeeklySubmission = typeof weeklySubmissions.$inferInsert;

/**
 * Measure Responses (resposta por medida dentro de uma submissão)
 */
export const measureResponses = mysqlTable("measure_responses", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  measureId: int("measureId").notNull(),
  status: mysqlEnum("status", ["I", "C", "NC", "NA"]),
  observations: text("observations"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MeasureResponse = typeof measureResponses.$inferSelect;
export type InsertMeasureResponse = typeof measureResponses.$inferInsert;

/**
 * Evidence Images (imagens/evidências por resposta de medida)
 */
export const evidenceImages = mysqlTable("evidence_images", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type EvidenceImage = typeof evidenceImages.$inferSelect;
export type InsertEvidenceImage = typeof evidenceImages.$inferInsert;

/**
 * Review Comments (comentários do RAA na revisão)
 */
export const reviewComments = mysqlTable("review_comments", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  measureId: int("measureId"),
  userId: int("userId").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReviewComment = typeof reviewComments.$inferSelect;
export type InsertReviewComment = typeof reviewComments.$inferInsert;

/**
 * Measure Reviews (veredicto por medida durante revisão RAA)
 * verdict: "ok" = conforme, "nok" = não conforme/rejeitar
 */
export const measureReviews = mysqlTable("measure_reviews", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  measureId: int("measureId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  verdict: mysqlEnum("verdict", ["ok", "nok"]).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MeasureReview = typeof measureReviews.$inferSelect;
export type InsertMeasureReview = typeof measureReviews.$inferInsert;

/**
 * Historical PDF uploads (fichas passadas em PDF para arquivo)
 */
export const historicalPdfs = mysqlTable("historical_pdfs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  projectId: int("projectId"),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }),
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type HistoricalPdf = typeof historicalPdfs.$inferSelect;
export type InsertHistoricalPdf = typeof historicalPdfs.$inferInsert;

/**
 * Invitations (convites para utilizadores pré-atribuídos a empresas)
 * Quando um admin convida alguém por email, cria-se um registo aqui.
 * No primeiro login, se o email corresponder a um convite pendente,
 * o utilizador é automaticamente atribuído à empresa e role indicados.
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  companyId: int("companyId").notNull(),
  role: mysqlEnum("role", ["user", "admin", "ee", "ee_partner", "raa", "rap", "dono_obra", "observador", "pm"]).default("ee").notNull(),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "expired"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

/**
 * Projects (obras/projetos: SIN02, SIN03, etc.)
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  workflowDescription: text("workflowDescription"),
  enabledModules: varchar("enabledModules", { length: 1000 }).notNull().default('["dashboard","calendar","map","timeline","ficha","residuos","kpi"]'),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project-Company association (quais empresas trabalham em cada projeto)
 */
export const projectCompanies = mysqlTable("project_companies", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  companyId: int("companyId").notNull(),
  startWeek: int("startWeek"),
  startYear: int("startYear"),
  endWeek: int("endWeek"),
  endYear: int("endYear"),
  bufferWeeks: int("bufferWeeks").default(4),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectCompany = typeof projectCompanies.$inferSelect;
export type InsertProjectCompany = typeof projectCompanies.$inferInsert;

/**
 * Weeks without work (semanas sem trabalhos — Natal, paragens, etc.)
 * Admin marks specific weeks where no submissions are expected
 */
export const weeksWithoutWork = mysqlTable("weeks_without_work", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  reason: varchar("reason", { length: 255 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WeekWithoutWork = typeof weeksWithoutWork.$inferSelect;
export type InsertWeekWithoutWork = typeof weeksWithoutWork.$inferInsert;

/**
 * Project-User association (quais utilizadores têm acesso a cada projeto)
 */
export const projectUsers = mysqlTable("project_users", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectUser = typeof projectUsers.$inferSelect;
export type InsertProjectUser = typeof projectUsers.$inferInsert;

// ─── Deletion Log ─────────────────────────────────────────────────────────────
export const deletionLogs = mysqlTable("deletion_logs", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  projectId: int("projectId"),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  companyId: int("companyId"),
  companyName: varchar("companyName", { length: 255 }),
  createdBy: int("createdBy"),
  deletedBy: int("deletedBy").notNull(),
  deletedByName: varchar("deletedByName", { length: 255 }),
  deletedByEmail: varchar("deletedByEmail", { length: 255 }),
  reason: text("reason"),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  recoveredAt: bigint("recoveredAt", { mode: "number" }),
});

export type DeletionLog = typeof deletionLogs.$inferSelect;
export type InsertDeletionLog = typeof deletionLogs.$inferInsert;

// ─── Evidence Files (ficheiros anexados por medida) ───────────────────────────
export const evidenceFiles = mysqlTable("evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type InsertEvidenceFile = typeof evidenceFiles.$inferInsert;

// ─── Monitoring Plans (Planos de Monitorização do DCAPE) ──────────────────────
export const monitoringPlans = mysqlTable("monitoring_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  planNumber: varchar("planNumber", { length: 50 }),
  name: varchar("name", { length: 500 }).notNull(),
  category: mysqlEnum("category", ["programa_monitorizacao", "plano_projeto"]).default("programa_monitorizacao").notNull(),
  periodicity: varchar("periodicity", { length: 100 }),
  phase: varchar("phase", { length: 100 }).default("construcao").notNull(),
  ownerId: int("ownerId"),
  ownerName: varchar("ownerName", { length: 255 }),
  supportName: varchar("supportName", { length: 255 }),
  supportCompany: varchar("supportCompany", { length: 255 }),
  supportEmail: varchar("supportEmail", { length: 320 }),
  supportPhone: varchar("supportPhone", { length: 80 }),
  trackingStatus: mysqlEnum("trackingStatus", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).default("nao_iniciado").notNull(),
  lastReportingDate: bigint("lastReportingDate", { mode: "number" }),
  nextReportingDate: bigint("nextReportingDate", { mode: "number" }),
  notes: text("notes"),
  submissionStatus: mysqlEnum("submissionStatus", ["pending", "submitted", "delivered"]).default("pending").notNull(),
  submittedFileUrl: varchar("submittedFileUrl", { length: 1000 }),
  submittedFileKey: varchar("submittedFileKey", { length: 500 }),
  submittedAt: bigint("submittedAt", { mode: "number" }),
  confirmedDeliveryAt: bigint("confirmedDeliveryAt", { mode: "number" }),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  planNumberUnique: uniqueIndex("monitoring_plans_plan_number_uq").on(table.planNumber),
}));
export type MonitoringPlan = typeof monitoringPlans.$inferSelect;
export type InsertMonitoringPlan = typeof monitoringPlans.$inferInsert;

// ─── Monitoring Plan Assignments (estado de cada plano em cada projecto) ───────
export const monitoringPlanAssignments = mysqlTable("monitoring_plan_assignments", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  projectId: int("projectId").notNull(),
  ownerId: int("ownerId"),
  ownerName: varchar("ownerName", { length: 255 }),
  status: mysqlEnum("status", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).default("nao_iniciado").notNull(),
  lastReportingDate: bigint("lastReportingDate", { mode: "number" }),
  nextReportingDate: bigint("nextReportingDate", { mode: "number" }),
  submissionStatus: mysqlEnum("submissionStatus", ["pending", "submitted", "delivered"]).default("pending").notNull(),
  confirmedDeliveryAt: bigint("confirmedDeliveryAt", { mode: "number" }),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  planProjectUnique: uniqueIndex("monitoring_plan_assignments_plan_project_uq").on(table.planId, table.projectId),
  projectIdx: index("monitoring_plan_assignments_project_idx").on(table.projectId),
  ownerIdx: index("monitoring_plan_assignments_owner_idx").on(table.ownerId),
  dueDateIdx: index("monitoring_plan_assignments_due_idx").on(table.nextReportingDate),
}));
export type MonitoringPlanAssignment = typeof monitoringPlanAssignments.$inferSelect;
export type InsertMonitoringPlanAssignment = typeof monitoringPlanAssignments.$inferInsert;

// ─── Monitoring Plan Status Updates (histórico imutável por projecto) ──────────
export const monitoringPlanUpdates = mysqlTable("monitoring_plan_updates", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId"),
  planId: int("planId"),
  status: mysqlEnum("status", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).notNull(),
  updateText: text("updateText").notNull(),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  assignmentCreatedIdx: index("monitoring_plan_updates_assignment_created_idx").on(table.assignmentId, table.createdAt),
  planCreatedIdx: index("monitoring_plan_updates_plan_created_idx").on(table.planId, table.createdAt),
}));
export type MonitoringPlanUpdate = typeof monitoringPlanUpdates.$inferSelect;
export type InsertMonitoringPlanUpdate = typeof monitoringPlanUpdates.$inferInsert;

// ─── Monitoring Plan Attachments (ficheiros no storage externo) ────────────────
export const monitoringPlanAttachments = mysqlTable("monitoring_plan_attachments", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId"),
  planId: int("planId"),
  updateId: int("updateId"),
  type: mysqlEnum("type", ["photo", "file"]).default("file").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  url: text("url").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedByName: varchar("uploadedByName", { length: 255 }).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
}, (table) => ({
  assignmentIdx: index("monitoring_plan_attachments_assignment_idx").on(table.assignmentId),
  planIdx: index("monitoring_plan_attachments_plan_idx").on(table.planId),
  updateIdx: index("monitoring_plan_attachments_update_idx").on(table.updateId),
}));
export type MonitoringPlanAttachment = typeof monitoringPlanAttachments.$inferSelect;
export type InsertMonitoringPlanAttachment = typeof monitoringPlanAttachments.$inferInsert;

// ─── Project Phases (Fases do Projeto - controlo por fase) ────────────────────
export const projectPhases = mysqlTable("project_phases", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  phaseKey: varchar("phaseKey", { length: 100 }).notNull(),
  phaseName: varchar("phaseName", { length: 255 }).notNull(),
  active: int("active").default(1).notNull(),
  orderIndex: int("orderIndex").default(0).notNull(),
  startDate: varchar("startDate", { length: 10 }),
  endDate: varchar("endDate", { length: 10 }),
  hidden: int("hidden").default(0).notNull(),
  progress: int("progress").default(0).notNull(),
  ownerId: int("ownerId"),
  ownerName: varchar("ownerName", { length: 255 }),
  supportName: varchar("supportName", { length: 255 }),
  supportCompany: varchar("supportCompany", { length: 255 }),
  supportEmail: varchar("supportEmail", { length: 320 }),
  supportPhone: varchar("supportPhone", { length: 80 }),
  trackingStatus: mysqlEnum("trackingStatus", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).default("nao_iniciado").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectPhaseUnique: uniqueIndex("project_phases_project_key_uq").on(table.projectId, table.phaseKey),
  ownerIdx: index("project_phases_owner_idx").on(table.ownerId),
}));
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type InsertProjectPhase = typeof projectPhases.$inferInsert;

export const projectPhaseUpdates = mysqlTable("project_phase_updates", {
  id: int("id").autoincrement().primaryKey(),
  phaseId: int("phaseId").notNull(),
  status: mysqlEnum("status", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).notNull(),
  updateText: text("updateText").notNull(),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  phaseIdx: index("project_phase_updates_phase_idx").on(table.phaseId),
  createdAtIdx: index("project_phase_updates_created_idx").on(table.createdAt),
}));
export type ProjectPhaseUpdate = typeof projectPhaseUpdates.$inferSelect;
export type InsertProjectPhaseUpdate = typeof projectPhaseUpdates.$inferInsert;

/**
 * Phase Measure Statuses (estado de cada medida nas novas fases, gerido pelo DO)
 */
export const phaseMeasureStatuses = mysqlTable("phase_measure_statuses", {
  id: int("id").autoincrement().primaryKey(),
  measureId: int("measureId").notNull(),
  projectId: int("projectId").notNull(),
  status: mysqlEnum("status", ["pendente", "em_curso", "concluido"]).default("pendente").notNull(),
  notes: text("notes"),
  ownerId: int("ownerId"),
  ownerName: varchar("ownerName", { length: 255 }),
  supportName: varchar("supportName", { length: 255 }),
  supportCompany: varchar("supportCompany", { length: 255 }),
  supportEmail: varchar("supportEmail", { length: 320 }),
  supportPhone: varchar("supportPhone", { length: 80 }),
  trackingStatus: mysqlEnum("trackingStatus", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).default("nao_iniciado").notNull(),
  firstDeliveryDate: bigint("firstDeliveryDate", { mode: "number" }),
  lastDeliveryDate: bigint("lastDeliveryDate", { mode: "number" }),
  nextDeliveryDate: bigint("nextDeliveryDate", { mode: "number" }),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectMeasureUnique: uniqueIndex("phase_measure_statuses_project_measure_uq").on(table.projectId, table.measureId),
  ownerIdx: index("phase_measure_statuses_owner_idx").on(table.ownerId),
}));

export type PhaseMeasureStatus = typeof phaseMeasureStatuses.$inferSelect;
export type InsertPhaseMeasureStatus = typeof phaseMeasureStatuses.$inferInsert;

// ─── Phase Measure Updates (histórico imutável por medida e projecto) ─────────
export const phaseMeasureUpdates = mysqlTable("phase_measure_updates", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  measureId: int("measureId").notNull(),
  status: mysqlEnum("status", ["nao_iniciado", "em_curso", "em_validacao", "concluido", "bloqueado"]).notNull(),
  updateText: text("updateText").notNull(),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectMeasureCreatedIdx: index("phase_measure_updates_project_measure_created_idx").on(table.projectId, table.measureId, table.createdAt),
  createdAtIdx: index("phase_measure_updates_created_idx").on(table.createdAt),
}));

export type PhaseMeasureUpdate = typeof phaseMeasureUpdates.$inferSelect;
export type InsertPhaseMeasureUpdate = typeof phaseMeasureUpdates.$inferInsert;

// ─── Phase Evidence (comentários, fotos e ficheiros por medida de fase) ────────
export const phaseEvidence = mysqlTable("phase_evidence", {
  id: int("id").autoincrement().primaryKey(),
  measureId: int("measureId").notNull(),
  projectId: int("projectId").notNull(),
  type: mysqlEnum("type", ["comment", "photo", "file"]).notNull(),
  content: text("content"), // text for comments, URL for photos/files
  fileKey: varchar("fileKey", { length: 500 }),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  referenceYear: int("referenceYear"),
});

export type PhaseEvidence = typeof phaseEvidence.$inferSelect;
export type InsertPhaseEvidence = typeof phaseEvidence.$inferInsert;

// ─── Calendar Events (eventos de reporting no calendário) ────────────────────
export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  periodicity: varchar("periodicity", { length: 100 }),
  firstDate: bigint("firstDate", { mode: "number" }).notNull(),
  nextDate: bigint("nextDate", { mode: "number" }),
  lastDeliveredDate: bigint("lastDeliveredDate", { mode: "number" }),
  category: varchar("category", { length: 100 }),
  status: mysqlEnum("status", ["pending", "reported", "confirmed"]).default("pending").notNull(),
  ownerId: int("ownerId"),
  ownerName: varchar("ownerName", { length: 255 }),
  sourceType: varchar("sourceType", { length: 50 }),
  sourceId: int("sourceId"),
  sourceKey: varchar("sourceKey", { length: 255 }),
  entityToDeliver: varchar("entityToDeliver", { length: 500 }),
  entityLink: varchar("entityLink", { length: 1000 }),
  active: int("active").default(1).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  sourceProjectUnique: uniqueIndex("calendar_events_source_project_uq").on(table.sourceType, table.sourceId, table.projectId),
  sourceKeyUnique: uniqueIndex("calendar_events_source_key_uq").on(table.sourceKey),
  ownerIdx: index("calendar_events_owner_idx").on(table.ownerId),
  nextDateIdx: index("calendar_events_next_date_idx").on(table.nextDate),
}));
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ─── Calendar Reminder Log (garante alertas 30/15/7 idempotentes) ───────────────
export const calendarReminderLogs = mysqlTable("calendar_reminder_logs", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  deadlineDate: bigint("deadlineDate", { mode: "number" }).notNull(),
  reminderDays: int("reminderDays").notNull(),
  recipientUserId: int("recipientUserId"),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (table) => ({
  reminderUnique: uniqueIndex("calendar_reminder_logs_unique").on(table.eventId, table.deadlineDate, table.reminderDays, table.recipientEmail),
  eventIdx: index("calendar_reminder_logs_event_idx").on(table.eventId),
}));
export type CalendarReminderLog = typeof calendarReminderLogs.$inferSelect;
export type InsertCalendarReminderLog = typeof calendarReminderLogs.$inferInsert;

// ─── App Settings (key-value for configurable items like brand images) ────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Waste e-GARs (MIRR - Mapa Integrado de Registo de Resíduos) ────────────
export const wasteSubprojects = mysqlTable("waste_subprojects", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 80 }),
  active: boolean("active").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectNameUnique: uniqueIndex("waste_subprojects_project_name_unique").on(table.projectId, table.name),
  projectIdx: index("waste_subprojects_project_idx").on(table.projectId),
}));
export type WasteSubproject = typeof wasteSubprojects.$inferSelect;
export type InsertWasteSubproject = typeof wasteSubprojects.$inferInsert;

export const wasteEgars = mysqlTable("waste_egars", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  subProjectId: int("subProjectId"),
  companyId: int("companyId"),
  parentCompanyId: int("parentCompanyId"),
  date: bigint("date", { mode: "number" }).notNull(),
  egarId: varchar("egarId", { length: 100 }),
  egarLink: varchar("egarLink", { length: 500 }),
  operator: varchar("operator", { length: 255 }),
  lerCode: varchar("lerCode", { length: 20 }).notNull(),
  designation: varchar("designation", { length: 500 }).notNull(),
  quantity: varchar("quantity", { length: 50 }).notNull(), // tonnes as string for precision
  destination: mysqlEnum("destination", ["recycled", "incinerated", "landfill"]).default("recycled"),
  correctedQuantity: varchar("correctedQuantity", { length: 50 }), // dados corrigidos prevalece sobre quantity
  month: int("month").notNull(), // 1-12
  year: int("year").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  projectYearIdx: index("waste_egars_project_year_idx").on(table.projectId, table.year),
  subProjectIdx: index("waste_egars_subproject_idx").on(table.subProjectId),
  companyIdx: index("waste_egars_company_idx").on(table.companyId),
}));
export type WasteEgar = typeof wasteEgars.$inferSelect;
export type InsertWasteEgar = typeof wasteEgars.$inferInsert;

// User feedback / melhorias
export const userFeedback = mysqlTable("user_feedback", {
  id: serial("id").primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 255 }),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).default("melhoria"),
  status: varchar("status", { length: 50 }).default("pendente"),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type UserFeedback = typeof userFeedback.$inferSelect;

// ─── KPI's de Sustentabilidade ──────────────────────────────────────────────

// Definições de métricas KPI (configuráveis pelo admin)
export const kpiMetrics = mysqlTable("kpi_metrics", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  nameEn: varchar("nameEn", { length: 500 }),
  unit: varchar("unit", { length: 50 }).notNull(),
  target: varchar("target", { length: 255 }),
  category: varchar("category", { length: 100 }).notNull(),
  inputType: varchar("inputType", { length: 20 }).notNull().default("manual"),
  formulaType: varchar("formulaType", { length: 50 }),
  formulaSourceMetricId: int("formulaSourceMetricId"),
  pci: varchar("pci", { length: 50 }),
  emissionFactor: varchar("emissionFactor", { length: 50 }),
  density: varchar("density", { length: 50 }),
  sortOrder: int("sortOrder").default(0),
  active: int("active").default(1),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type KpiMetric = typeof kpiMetrics.$inferSelect;
export type InsertKpiMetric = typeof kpiMetrics.$inferInsert;

// Submissões semanais de KPIs por empresa/projeto
export const kpiSubmissions = mysqlTable("kpi_submissions", {
  id: serial("id").primaryKey(),
  projectId: int("projectId").notNull(),
  companyId: int("companyId").notNull(),
  parentCompanyId: int("parentCompanyId"),
  sourceType: mysqlEnum("sourceType", ["ee", "ee_partner"]).default("ee").notNull(),
  userId: int("userId"),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  status: varchar("status", { length: 20 }).default("submitted"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  contributionUnique: uniqueIndex("kpi_submissions_contribution_unique").on(table.projectId, table.companyId, table.weekNumber, table.weekYear),
  parentCompanyIdx: index("kpi_submissions_parent_company_idx").on(table.parentCompanyId),
}));
export type KpiSubmission = typeof kpiSubmissions.$inferSelect;
export type InsertKpiSubmission = typeof kpiSubmissions.$inferInsert;

// Valores individuais por métrica por submissão
export const kpiValues = mysqlTable("kpi_values", {
  id: serial("id").primaryKey(),
  submissionId: int("submissionId").notNull(),
  metricId: int("metricId").notNull(),
  value: varchar("value", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow(),
});
export type KpiValue = typeof kpiValues.$inferSelect;
export type InsertKpiValue = typeof kpiValues.$inferInsert;

// KPI Targets (Metas)
export const kpiTargets = mysqlTable("kpi_targets", {
  id: serial("id").primaryKey(),
  metricId: int("metricId").notNull(),
  projectId: int("projectId").notNull(),
  targetType: varchar("targetType", { length: 20 }).notNull().default("monthly"),
  targetValue: varchar("targetValue", { length: 255 }).notNull(),
  targetDirection: varchar("targetDirection", { length: 10 }).notNull().default("max"),
  year: int("year").notNull(),
  month: int("month"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type KpiTarget = typeof kpiTargets.$inferSelect;
export type InsertKpiTarget = typeof kpiTargets.$inferInsert;

// KPI Incidents Log
export const kpiIncidents = mysqlTable("kpi_incidents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("aberto"),
  severity: varchar("severity", { length: 50 }).notNull().default("baixo"),
  link: varchar("link", { length: 1000 }),
  createdBy: varchar("createdBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KpiIncident = typeof kpiIncidents.$inferSelect;

// Audit log for admin actions
export const auditLog = mysqlTable("audit_log", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 255 }).notNull(),
  entity: varchar("entity", { length: 255 }),
  entityId: int("entityId"),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Notification recipients per project — who gets email when fichas are submitted
export const notificationRecipients = mysqlTable("notification_recipients", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  notificationType: varchar("notificationType", { length: 50 }).notNull().default("submission"), // submission, approval, rejection, all
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});
