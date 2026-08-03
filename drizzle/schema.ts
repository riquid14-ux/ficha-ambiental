import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  companyId: int("companyId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Companies (Empresas Executantes - EE)
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("shortName", { length: 50 }).notNull(),
  logoUrl: text("logoUrl"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
  weekNumber: int("weekNumber").notNull(),
  weekYear: int("weekYear").notNull(),
  weekStartDate: varchar("weekStartDate", { length: 10 }).notNull(),
  weekEndDate: varchar("weekEndDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["draft", "submitted"]).default("draft").notNull(),
  submittedBy: int("submittedBy"),
  submittedAt: bigint("submittedAt", { mode: "number" }),
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
