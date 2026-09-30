import type { User } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import * as db from "./db";

const PUBLIC_BRANDING_KEYS = new Set([
  "start_campus_logo_be5e1215.png",
  "sc-aerial-1_176e4635.jpg",
  "sc-aerial-2_18fcfe53.png",
  "sc-datacenter-1_78c8d65f.jpg",
  "sc-sin01_2c20c2d5.png",
  "start-campus-1_fdbe2fde.jpg",
  "start-campus-2_23725165.jpg",
  "start-campus-4_9ce4d2bc.jpg",
  "start-campus-5_5d8e4400.jpg",
  "start-campus-6_49846847.jpg",
  "start-campus-7_9876e6c3.jpg",
  "start-campus-8_1bdb1eb1.jpg",
  "start-campus-9_0e9ab8b0.jpg",
  "start-campus-10_f1d3919f.jpg",
  "start-campus-11_fced6e75.jpg",
  "start-campus-12_e458c914.jpg",
  "start-campus-13_c68ebb45.jpg",
  "start-campus-14_ed04207a.jpg",
  "start-campus-15_72f83746.jpg",
  "start-campus-16_e7622842.jpg",
  "start-campus-17_de17c18d.jpg",
  "start-campus-18_9a4385f8.jpg",
  "start-campus-19_1fd1e617.jpg",
  "start-campus-rdcd_d271a631.png",
  "gleeds-rdcd_56c50b11.png",
  "quadrante-rdcd_c9e7bf7d.jpg",
]);

const ADMIN_ROLES = new Set(["admin", "dono_obra"]);
const OPERATION_PROJECT_CODE = "SIN01";

type ProjectModule = "ficha" | "timeline" | "planos" | "operacao";

export function isPublicBrandingKey(key: string) {
  // Apenas administradores podem criar objetos com o prefixo branding/. O
  // conteúdo é fotografia institucional, deliberadamente pública para poder
  // aparecer antes da autenticação no login e na entrada da plataforma.
  return PUBLIC_BRANDING_KEYS.has(key) || key.startsWith("branding/");
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

  // As marcas escolhidas para um RDCD não são ativos públicos: a chave contém
  // o projeto e só é disponibilizada a quem pode elaborar o relatório desse
  // projeto. Isto também cobre rascunhos ainda não guardados na base de dados.
  const rdcdBrandMatch = key.match(/^rdcd-branding\/(\d+)\/[A-Za-z0-9._-]+$/);
  if (rdcdBrandMatch) {
    return ADMIN_ROLES.has(user.role) && canAccessProject(user, Number(rdcdBrandMatch[1]), "timeline");
  }

  // A Biblioteca Documental e as pré-visualizações de importação têm rotas ou
  // ciclos de vida próprios; uma chave avulsa nunca pode autorizar a descarga.
  return false;
}
