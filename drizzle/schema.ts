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
  sessionVersion: int("sessionVersion").default(0).notNull(),
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
  // O catálogo regulatório pertence a um projeto; SIN01 mantém o seu catálogo de operação isolado.
  projectId: int("projectId"),
  name: varchar("name", { length: 500 }).notNull(),
  orderIndex: int("orderIndex").notNull(),
  phase: varchar("phase", { length: 100 }).notNull(),
}, (table) => ({
  projectOrderIdx: index("sections_project_order_idx").on(table.projectId, table.orderIndex),
}));

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

/**
 * Measures (156 medidas de minimização)
 */
export const measures = mysqlTable("measures", {
  id: int("id").autoincrement().primaryKey(),
  // Redundância controlada para consultas e validações de pertença sem depender apenas da secção.
  projectId: int("projectId"),
  number: varchar("number", { length: 20 }).notNull(),
  description: text("description").notNull(),
  responsible: varchar("responsible", { length: 50 }).notNull(),
  sectionId: int("sectionId").notNull(),
  orderIndex: int("orderIndex").notNull(),
}, (table) => ({
  projectSectionOrderIdx: index("measures_project_section_order_idx").on(table.projectId, table.sectionId, table.orderIndex),
}));

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
}, (table) => ({
  fileKeyIdx: index("evidence_images_file_key_idx").on(table.fileKey),
}));

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
}, (table) => ({
  fileKeyIdx: index("historical_pdfs_file_key_idx").on(table.fileKey),
}));

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
  accessModules: varchar("accessModules", { length: 1000 }),
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
}, (table) => ({
  fileKeyIdx: index("evidence_files_file_key_idx").on(table.fileKey),
}));
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
  fileKeyIdx: index("monitoring_plan_attachments_file_key_idx").on(table.fileKey),
}));
export type MonitoringPlanAttachment = typeof monitoringPlanAttachments.$inferSelect;
export type InsertMonitoringPlanAttachment = typeof monitoringPlanAttachments.$inferInsert;

// ─── Biblioteca Documental (PDF privado em storage externo) ───────────────────
export const documentLibrary = mysqlTable("document_library", {
  id: int("id").autoincrement().primaryKey(),
  topic: mysqlEnum("topic", ["obrigacoes_ambientais", "certificacoes", "recomendacoes"]).notNull(),
  subtopic: varchar("subtopic", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  language: varchar("language", { length: 50 }).notNull(),
  description: text("description"),
  appliesToAllProjects: int("appliesToAllProjects").default(0).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  isProjectCentral: int("isProjectCentral").default(0).notNull(),
  isMandatoryRead: int("isMandatoryRead").default(0).notNull(),
  centralOrder: int("centralOrder").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusTopicIdx: index("document_library_status_topic_idx").on(table.status, table.topic),
  centralIdx: index("document_library_central_idx").on(table.status, table.isProjectCentral, table.centralOrder),
  topicSubtopicIdx: index("document_library_topic_subtopic_idx").on(table.topic, table.subtopic),
  createdAtIdx: index("document_library_created_idx").on(table.createdAt),
}));

export type DocumentLibraryItem = typeof documentLibrary.$inferSelect;
export type InsertDocumentLibraryItem = typeof documentLibrary.$inferInsert;

/**
 * Âmbito de projeto de cada documento da biblioteca. Quando appliesToAllProjects
 * está ativo no documento, esta tabela não é necessária; caso contrário, pelo
 * menos um projeto deve ser associado aqui.
 */
export const documentLibraryProjects = mysqlTable("document_library_projects", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  projectId: int("projectId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  documentProjectUnique: uniqueIndex("document_library_project_unique").on(table.documentId, table.projectId),
  projectIdx: index("document_library_project_idx").on(table.projectId, table.documentId),
}));

export type DocumentLibraryProject = typeof documentLibraryProjects.$inferSelect;
export type InsertDocumentLibraryProject = typeof documentLibraryProjects.$inferInsert;

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
}, (table) => ({
  fileKeyIdx: index("phase_evidence_file_key_idx").on(table.fileKey),
}));

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

// Histórico explícito de rascunhos, submissões e correções KPI.
// Os valores ficam em JSON de auditoria; os valores operacionais continuam em kpi_values.
export const kpiSubmissionChanges = mysqlTable("kpi_submission_changes", {
  id: serial("id").primaryKey(),
  submissionId: int("submissionId").notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  actorId: int("actorId").notNull(),
  actorName: varchar("actorName", { length: 255 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  changedValues: text("changedValues"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  submissionIdx: index("kpi_submission_changes_submission_idx").on(table.submissionId, table.createdAt),
}));
export type KpiSubmissionChange = typeof kpiSubmissionChanges.$inferSelect;
export type InsertKpiSubmissionChange = typeof kpiSubmissionChanges.$inferInsert;

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

// ─── Operação do edifício (NEST / SIN01) ─────────────────────────────────────
// Dados operacionais medidos, faturas e cenários são deliberadamente separados.
// Assim, previsões não podem ser agregadas a valores efetivamente importados.
export const operationImportBatches = mysqlTable("operation_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceFilename: varchar("sourceFilename", { length: 255 }).notNull(),
  sourceFileKey: varchar("sourceFileKey", { length: 500 }).notNull(),
  sourceFileUrl: text("sourceFileUrl").notNull(),
  sourceType: mysqlEnum("sourceType", ["daily_report", "bms_extract", "manual_import"]).default("daily_report").notNull(),
  measuredDate: varchar("measuredDate", { length: 10 }),
  rowsImported: int("rowsImported").default(0).notNull(),
  qualityStatus: mysqlEnum("qualityStatus", ["valid", "warning", "invalid"]).default("valid").notNull(),
  qualityNotes: text("qualityNotes"),
  importedBy: int("importedBy").notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
}, (table) => ({
  projectDateIdx: index("operation_import_batches_project_date_idx").on(table.projectId, table.measuredDate),
  sourceFileKeyIdx: index("operation_import_batches_source_file_key_idx").on(table.sourceFileKey),
}));
export type OperationImportBatch = typeof operationImportBatches.$inferSelect;
export type InsertOperationImportBatch = typeof operationImportBatches.$inferInsert;

export const operationReadings = mysqlTable("operation_readings", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  batchId: int("batchId"),
  metricCode: varchar("metricCode", { length: 100 }).notNull(),
  metricLabel: varchar("metricLabel", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["energia", "agua", "arrefecimento", "carbono", "conformidade", "custo"]).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  value: varchar("value", { length: 80 }).notNull(),
  measuredAt: bigint("measuredAt", { mode: "number" }).notNull(),
  granularity: mysqlEnum("granularity", ["quinze_minutos", "diario", "mensal", "anual"]).default("diario").notNull(),
  source: mysqlEnum("source", ["bms_report", "invoice", "manual", "calculated"]).default("bms_report").notNull(),
  dataQuality: mysqlEnum("dataQuality", ["valid", "warning", "invalid"]).default("valid").notNull(),
  qualityNote: varchar("qualityNote", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  projectMetricDateIdx: index("operation_readings_project_metric_date_idx").on(table.projectId, table.metricCode, table.measuredAt),
  batchIdx: index("operation_readings_batch_idx").on(table.batchId),
  uniqueReading: uniqueIndex("operation_readings_unique").on(table.projectId, table.metricCode, table.measuredAt, table.granularity, table.source),
}));
export type OperationReading = typeof operationReadings.$inferSelect;
export type InsertOperationReading = typeof operationReadings.$inferInsert;

export const operationInvoices = mysqlTable("operation_invoices", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  invoiceType: mysqlEnum("invoiceType", ["electricidade", "agua_potavel", "agua_industrial", "hvo", "gasoleo", "outro"]).notNull(),
  supplier: varchar("supplier", { length: 255 }),
  invoiceNumber: varchar("invoiceNumber", { length: 120 }),
  periodStart: varchar("periodStart", { length: 10 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 10 }).notNull(),
  quantity: varchar("quantity", { length: 80 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  totalCost: varchar("totalCost", { length: 80 }),
  currency: varchar("currency", { length: 8 }).default("EUR").notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  fileUrl: text("fileUrl"),
  filename: varchar("filename", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  reconciliationStatus: mysqlEnum("reconciliationStatus", ["por_reconciliar", "conforme", "desvio", "incompleta"]).default("por_reconciliar").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  projectPeriodIdx: index("operation_invoices_project_period_idx").on(table.projectId, table.periodStart, table.periodEnd),
  projectTypeIdx: index("operation_invoices_project_type_idx").on(table.projectId, table.invoiceType),
  fileKeyIdx: index("operation_invoices_file_key_idx").on(table.fileKey),
}));
export type OperationInvoice = typeof operationInvoices.$inferSelect;
export type InsertOperationInvoice = typeof operationInvoices.$inferInsert;

export const operationScenarios = mysqlTable("operation_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  coolingStrategy: mysqlEnum("coolingStrategy", ["agua_mar", "chiller", "hibrido_adiabatico", "torres_evaporativas", "outro"]).notNull(),
  assumptionsJson: text("assumptionsJson").notNull(),
  resultJson: text("resultJson").notNull(),
  baselineStart: varchar("baselineStart", { length: 10 }),
  baselineEnd: varchar("baselineEnd", { length: 10 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
}, (table) => ({
  projectCreatedIdx: index("operation_scenarios_project_created_idx").on(table.projectId, table.createdAt),
}));
export type OperationScenario = typeof operationScenarios.$inferSelect;
export type InsertOperationScenario = typeof operationScenarios.$inferInsert;

// Configuração aprovada pela Administração para converter leituras medidas em
// indicadores ambientais e avaliar limites de licença. Todos os campos são
// opcionais para impedir cálculos por suposição quando ainda não existe valor
// formalmente validado para o projeto.
export const operationSettings = mysqlTable("operation_settings", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  configurationMode: varchar("configurationMode", { length: 20 }).notNull().default("approved"),
  electricityCarbonFactorKgKwh: varchar("electricityCarbonFactorKgKwh", { length: 80 }),
  waterPotableCarbonFactorKgM3: varchar("waterPotableCarbonFactorKgM3", { length: 80 }),
  waterIndustrialCarbonFactorKgM3: varchar("waterIndustrialCarbonFactorKgM3", { length: 80 }),
  maxPue: varchar("maxPue", { length: 80 }),
  maxSeawaterReturnTempC: varchar("maxSeawaterReturnTempC", { length: 80 }),
  minSeawaterFlowLps: varchar("minSeawaterFlowLps", { length: 80 }),
  maxSeawaterFlowLps: varchar("maxSeawaterFlowLps", { length: 80 }),
  maxSeawaterDeltaTK: varchar("maxSeawaterDeltaTK", { length: 80 }),
  electricityPriceEurKwh: varchar("electricityPriceEurKwh", { length: 80 }),
  waterPriceEurM3: varchar("waterPriceEurM3", { length: 80 }),
  annualMaintenanceBudgetEur: varchar("annualMaintenanceBudgetEur", { length: 80 }),
  targetPue: varchar("targetPue", { length: 80 }),
  targetWueLkwh: varchar("targetWueLkwh", { length: 80 }),
  forecastHorizonDays: int("forecastHorizonDays"),
  coolingStrategyBaseline: varchar("coolingStrategyBaseline", { length: 40 }),
  infrastructureFutureAreaJson: text("infrastructureFutureAreaJson"),
  infrastructureMapLabelsJson: text("infrastructureMapLabelsJson"),
  operationImportMappingJson: text("operationImportMappingJson"),
  updatedBy: int("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectUnique: uniqueIndex("operation_settings_project_unique").on(table.projectId),
}));
export type OperationSettings = typeof operationSettings.$inferSelect;
export type InsertOperationSettings = typeof operationSettings.$inferInsert;

// Pontos estáticos sobre a fotografia de infraestrutura do SIN01/NEST. Não são
// dados geográficos nem um módulo de mapas; as coordenadas são percentagens da
// imagem e cada ponto pode associar métricas, gráfico, documento e nota técnica.
export const operationInfrastructurePoints = mysqlTable("operation_infrastructure_points", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  subtitle: varchar("subtitle", { length: 255 }),
  systemType: varchar("systemType", { length: 80 }).notNull().default("infraestrutura"),
  status: varchar("status", { length: 40 }).notNull().default("operacional"),
  xPercent: int("xPercent").notNull(),
  yPercent: int("yPercent").notNull(),
  description: text("description"),
  metricCodesJson: text("metricCodesJson").notNull(),
  chartMetricCode: varchar("chartMetricCode", { length: 100 }),
  documentTitle: varchar("documentTitle", { length: 255 }),
  documentUrl: varchar("documentUrl", { length: 1000 }),
  technicalNote: text("technicalNote"),
  technicalDataJson: text("technicalDataJson"),
  invoiceTypesJson: text("invoiceTypesJson"),
  chartDataJson: text("chartDataJson"),
  chartFileKey: varchar("chartFileKey", { length: 500 }),
  chartFileUrl: varchar("chartFileUrl", { length: 1000 }),
  chartFileName: varchar("chartFileName", { length: 255 }),
  cardLayout: varchar("cardLayout", { length: 32 }).notNull().default("standard"),
  cardAccent: varchar("cardAccent", { length: 32 }).notNull().default("teal"),
  cardImageKey: varchar("cardImageKey", { length: 500 }),
  cardImageUrl: varchar("cardImageUrl", { length: 1000 }),
  isFuture: boolean("isFuture").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  projectOrderIdx: index("operation_infrastructure_points_project_order_idx").on(table.projectId, table.sortOrder),
  cardImageKeyIdx: index("operation_infrastructure_card_image_key_idx").on(table.cardImageKey),
  chartFileKeyIdx: index("operation_infrastructure_chart_file_key_idx").on(table.chartFileKey),
}));
export type OperationInfrastructurePoint = typeof operationInfrastructurePoints.$inferSelect;
export type InsertOperationInfrastructurePoint = typeof operationInfrastructurePoints.$inferInsert;

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

/**
 * Registo administrativo de incidentes e retoma. Não contém segredos, dados de
 * sessão nem cópias de ficheiros; concentra apenas contexto operacional para
 * coordenação da recuperação e aprendizagem pós-incidente.
 */
export const operationalIncidents = mysqlTable("operational_incidents", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  status: mysqlEnum("status", ["open", "investigating", "monitoring", "resolved"]).notNull().default("open"),
  affectedServices: varchar("affectedServices", { length: 500 }).notNull().default("Aplicação"),
  impactSummary: text("impactSummary"),
  recoverySteps: text("recoverySteps"),
  followUpActions: text("followUpActions"),
  occurredAt: timestamp("occurredAt").notNull().defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusOccurredIdx: index("operational_incidents_status_occurred_idx").on(table.status, table.occurredAt),
}));

export type OperationalIncident = typeof operationalIncidents.$inferSelect;
export type InsertOperationalIncident = typeof operationalIncidents.$inferInsert;

// Notification recipients per project — who gets email when fichas are submitted
export const notificationRecipients = mysqlTable("notification_recipients", {
  id: int("id").primaryKey().autoincrement(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  notificationType: varchar("notificationType", { length: 50 }).notNull().default("submission"), // submission, approval, rejection, all
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});
