/**
 * Archive Provider — Abstraction layer for external document storage.
 * 
 * Currently uses S3 (via Manus storage) for development/testing.
 * IT switches to SharePoint by setting STORAGE_PROVIDER=sharepoint
 * and configuring SHAREPOINT_* environment variables.
 * 
 * All finalized data (approved fichas, KPIs, resíduos, planos, certificações)
 * is archived here. The local DB only holds in-transit data.
 */

import { storagePut, storageGet } from "./storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ArchivedDocument {
  id: string;               // Unique archive ID (e.g. "fichas/SIN02/2026/S33/submission_123")
  type: ArchiveType;
  projectCode: string;       // e.g. "SIN02"
  year: number;
  metadata: Record<string, any>;  // Flexible metadata (week, company, status, etc.)
  dataUrl: string;           // URL to the JSON data file
  createdAt: number;         // Unix timestamp
}

export type ArchiveType = 
  | "ficha"           // Fichas semanais aprovadas
  | "plano"           // Planos de monitorização
  | "residuo"         // MIRR / Gestão de Resíduos
  | "kpi"             // KPI submissions
  | "certificacao"    // LEED/EED/CELE evidências
  | "gamma";          // GAMMA candidaturas/projectos

export interface ArchiveQuery {
  type?: ArchiveType;
  projectCode?: string;
  year?: number;
  weekNumber?: number;
  companyId?: number;
  startWeek?: number;
  endWeek?: number;
}

export interface ArchiveData {
  submission: any;
  responses: any[];
  evidenceUrls: string[];
  reviewComments?: any[];
}

// ─── Archive Index ──────────────────────────────────────────────────────────
// We maintain a JSON index file per project/year for fast lookups
// This avoids listing all S3 objects (slow) or querying SharePoint (complex)

const INDEX_PREFIX = "archive/index";

async function getIndex(projectCode: string, year: number): Promise<ArchivedDocument[]> {
  const indexKey = `${INDEX_PREFIX}/${projectCode}/${year}.json`;
  try {
    const { url } = await storageGet(indexKey);
    const resp = await fetch(url.startsWith("/") ? `http://localhost:${process.env.PORT || 3000}${url}` : url);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

async function saveIndex(projectCode: string, year: number, index: ArchivedDocument[]): Promise<void> {
  const indexKey = `${INDEX_PREFIX}/${projectCode}/${year}.json`;
  const data = JSON.stringify(index, null, 2);
  await storagePut(indexKey, Buffer.from(data), "application/json");
}

// ─── S3 Provider (default) ──────────────────────────────────────────────────

/**
 * Archive a document to external storage.
 * Serializes the data as JSON, uploads to S3, and updates the index.
 */
export async function archiveDocument(
  type: ArchiveType,
  projectCode: string,
  year: number,
  data: any,
  metadata: Record<string, any> = {}
): Promise<ArchivedDocument> {
  const timestamp = Date.now();
  const id = `archive/${type}/${projectCode}/${year}/${timestamp}`;
  
  // Upload the actual data as JSON
  const jsonData = JSON.stringify(data, null, 2);
  const { url: dataUrl } = await storagePut(
    `${id}/data.json`,
    Buffer.from(jsonData),
    "application/json"
  );

  const doc: ArchivedDocument = {
    id,
    type,
    projectCode,
    year,
    metadata: { ...metadata, archivedAt: timestamp },
    dataUrl,
    createdAt: timestamp,
  };

  // Update the index (append)
  // Note: in production with SharePoint, the index would be a SharePoint list
  // For S3, we maintain a JSON file per project/year
  try {
    const index = await getIndex(projectCode, year);
    index.push(doc);
    await saveIndex(projectCode, year, index);
  } catch (e) {
    // Index update failure is non-fatal — the data is already saved
    console.warn("Archive index update failed (non-fatal):", e);
  }

  return doc;
}

/**
 * Retrieve archived documents by query.
 * Returns metadata only (not the full data) for listing/preview.
 */
export async function listArchived(query: ArchiveQuery): Promise<ArchivedDocument[]> {
  const projectCode = query.projectCode || "ALL";
  const year = query.year || new Date().getFullYear();
  
  let index = await getIndex(projectCode, year);
  
  // Apply filters
  if (query.type) {
    index = index.filter(d => d.type === query.type);
  }
  if (query.weekNumber) {
    index = index.filter(d => d.metadata.weekNumber === query.weekNumber);
  }
  if (query.companyId) {
    index = index.filter(d => d.metadata.companyId === query.companyId);
  }
  if (query.startWeek && query.endWeek) {
    index = index.filter(d => {
      const w = d.metadata.weekNumber;
      return w >= query.startWeek! && w <= query.endWeek!;
    });
  }

  return index.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Retrieve the full data of an archived document.
 * Downloads the JSON from storage and returns it.
 */
export async function getArchivedData(doc: ArchivedDocument): Promise<any> {
  try {
    const resp = await fetch(
      doc.dataUrl.startsWith("/") 
        ? `http://localhost:${process.env.PORT || 3000}${doc.dataUrl}` 
        : doc.dataUrl
    );
    if (!resp.ok) throw new Error(`Failed to fetch archived data: ${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error("Failed to retrieve archived data:", e);
    throw e;
  }
}

/**
 * Archive evidence images alongside a document.
 * Returns the storage URLs for the uploaded images.
 */
export async function archiveImages(
  archiveId: string,
  images: { buffer: Buffer; filename: string; mimeType: string }[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const img of images) {
    try {
      const { url } = await storagePut(
        `${archiveId}/evidence/${img.filename}`,
        img.buffer,
        img.mimeType
      );
      urls.push(url);
    } catch (e) {
      console.warn(`Failed to archive image ${img.filename}:`, e);
    }
  }
  return urls;
}
