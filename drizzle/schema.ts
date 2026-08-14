import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, serial } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "ee", "raa", "rap", "dono_obra", "observador", "pm"]).default("user").notNull(),
  companyId: int("companyId"),
  fullName: varchar("fullName", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: int("mustChangePassword").default(1),
  totpSecret: varchar("totpSecret", { length: 255 }),
  totpEnabled: int("totpEnabled").default(0),
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
  companyType: mysqlEnum("companyType", ["ee", "rap", "dono_obra", "raa", "observador"]).default("ee").notNull(),
  logoUrl: text("logoUrl"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

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
  role: mysqlEnum("role", ["user", "admin", "ee", "raa", "rap", "dono_obra", "observador", "pm"]).default("ee").notNull(),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectCompany = typeof projectCompanies.$inferSelect;
export type InsertProjectCompany = typeof projectCompanies.$inferInsert;

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
  name: varchar("name", { length: 500 }).notNull(),
  category: mysqlEnum("category", ["programa_monitorizacao", "plano_projeto"]).default("programa_monitorizacao").notNull(),
  periodicity: varchar("periodicity", { length: 100 }),
  phase: varchar("phase", { length: 100 }).default("construcao").notNull(),
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
});
export type MonitoringPlan = typeof monitoringPlans.$inferSelect;
export type InsertMonitoringPlan = typeof monitoringPlans.$inferInsert;

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type InsertProjectPhase = typeof projectPhases.$inferInsert;

/**
 * Phase Measure Statuses (estado de cada medida nas novas fases, gerido pelo DO)
 */
export const phaseMeasureStatuses = mysqlTable("phase_measure_statuses", {
  id: int("id").autoincrement().primaryKey(),
  measureId: int("measureId").notNull(),
  projectId: int("projectId").notNull(),
  status: mysqlEnum("status", ["pendente", "em_curso", "concluido"]).default("pendente").notNull(),
  notes: text("notes"),
  firstDeliveryDate: bigint("firstDeliveryDate", { mode: "number" }),
  lastDeliveryDate: bigint("lastDeliveryDate", { mode: "number" }),
  nextDeliveryDate: bigint("nextDeliveryDate", { mode: "number" }),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PhaseMeasureStatus = typeof phaseMeasureStatuses.$inferSelect;
export type InsertPhaseMeasureStatus = typeof phaseMeasureStatuses.$inferInsert;

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
  entityToDeliver: varchar("entityToDeliver", { length: 500 }),
  entityLink: varchar("entityLink", { length: 1000 }),
  active: int("active").default(1).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ─── App Settings (key-value for configurable items like brand images) ────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ─── Waste e-GARs (MIRR - Mapa Integrado de Registo de Resíduos) ────────────
export const wasteEgars = mysqlTable("waste_egars", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
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
});
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
  userId: int("userId"),
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  status: varchar("status", { length: 20 }).default("submitted"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});
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
