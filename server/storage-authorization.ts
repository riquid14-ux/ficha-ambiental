import type { User } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import * as db from "./db";

const PUBLIC_BRANDING_KEYS = new Set([
  "start_campus_logo_be5e1215.png",
  "sc-aerial-1_176e4635.jpg",
  "sc-aerial-2_18fcfe53.png",
  "sc-datacenter-1_78c8d65f.jpg",
  "sc-sin01_2c20c2d5.png",
]);

const ADMIN_ROLES = new Set(["admin", "dono_obra"]);
const OPERATION_PROJECT_CODE = "SIN01";

type ProjectModule = "ficha" | "timeline" | "planos" | "operacao";

export function isPublicBrandingKey(key: string) {
  return PUBLIC_BRANDING_KEYS.has(key);
}

export function isSafeStorageKey(key: string) {
  return Boolean(key)
    && key.length <= 500
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)
    && !key.split("/").some(segment => segment === "." || segment === "..");
}

function parsePmModules(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === "string")) : null;
  } catch {
    return null;
  }
}

async function canAccessProject(user: User, projectId: number, module: ProjectModule) {
  const project = await db.getProjectById(projectId);
  if (!project) return false;
  if (ADMIN_ROLES.has(user.role)) return true;

  const [userProjects, companyProjects] = await Promise.all([
    db.getUserProjects(user.id),
    user.companyId ? db.getProjectsForCompany(user.companyId) : Promise.resolve([]),
  ]);
  const assignment = userProjects.find(item => item.projectId === projectId);
  const assigned = user.role === "pm"
    ? Boolean(assignment)
    : Boolean(assignment || companyProjects.some(item => item.projectId === projectId));
  if (!assigned) return false;

  if (user.role === "pm") {
    const modules = parsePmModules(assignment?.accessModules);
    if (modules && !modules.has(module)) return false;
  }
  if (module === "operacao" && project.code !== OPERATION_PROJECT_CODE) return false;
  return true;
}

async function canReadSubmission(user: User, row: { projectId: number | null; companyId: number }) {
  if (!row.projectId || !await canAccessProject(user, row.projectId, "ficha")) return false;
  if (ADMIN_ROLES.has(user.role) || user.role === "raa" || user.role === "observador" || user.role === "pm") return true;
  return user.companyId === row.companyId;
}

async function findRows(query: ReturnType<typeof sql>) {
  const database = await db.getDb();
  if (!database) return [] as any[];
  const result = await database.execute(query);
  return (result as any)?.[0] || [];
}

/**
 * Resolves a stored object by exact key and checks the same resource scope used
 * by the application. Unknown, malformed and ambiguous keys are denied.
 */
export async function authorizeStorageRead(user: User, key: string) {
  if (!isSafeStorageKey(key)) return false;

  const submissionRows = await findRows(sql`
    SELECT ws.projectId, ws.companyId FROM evidence_images ei
      INNER JOIN measure_responses mr ON mr.id = ei.responseId
      INNER JOIN weekly_submissions ws ON ws.id = mr.submissionId
    WHERE ei.fileKey = ${key}
    UNION ALL
    SELECT ws.projectId, ws.companyId FROM evidence_files ef
      INNER JOIN measure_responses mr ON mr.id = ef.responseId
      INNER JOIN weekly_submissions ws ON ws.id = mr.submissionId
    WHERE ef.fileKey = ${key}
    UNION ALL
    SELECT hp.projectId, hp.companyId FROM historical_pdfs hp WHERE hp.fileKey = ${key}
  `);
  if (submissionRows.length > 0) {
    if (submissionRows.length !== 1) return false;
    return canReadSubmission(user, submissionRows[0]);
  }

  const phaseRows = await findRows(sql`SELECT projectId FROM phase_evidence WHERE fileKey = ${key}`);
  if (phaseRows.length > 0) return phaseRows.length === 1 && canAccessProject(user, Number(phaseRows[0].projectId), "timeline");

  const planRows = await findRows(sql`
    SELECT assignment.projectId FROM monitoring_plan_attachments attachment
      INNER JOIN monitoring_plan_assignments assignment ON assignment.id = attachment.assignmentId
    WHERE attachment.fileKey = ${key}
    UNION ALL
    SELECT assignment.projectId FROM monitoring_plans plan
      INNER JOIN monitoring_plan_assignments assignment ON assignment.planId = plan.id
    WHERE plan.submittedFileKey = ${key}
  `);
  if (planRows.length > 0) {
    const grants = await Promise.all(planRows.map((row: { projectId: number }) => canAccessProject(user, Number(row.projectId), "planos")));
    return grants.some(Boolean);
  }

  const operationRows = await findRows(sql`
    SELECT projectId FROM operation_import_batches WHERE sourceFileKey = ${key}
    UNION ALL
    SELECT projectId FROM operation_invoices WHERE fileKey = ${key}
    UNION ALL
    SELECT projectId FROM operation_infrastructure_points WHERE chartFileKey = ${key} OR cardImageKey = ${key}
  `);
  if (operationRows.length > 0) return operationRows.length === 1 && canAccessProject(user, Number(operationRows[0].projectId), "operacao");

  // A Biblioteca Documental e as pré-visualizações de importação têm rotas ou
  // ciclos de vida próprios; uma chave avulsa nunca pode autorizar a descarga.
  return false;
}
