/**
 * Integration Hub
 * 
 * Central module that routes documents to the correct external storage:
 * - SharePoint: for internal documents (RDCD, Planos, MIRR exports)
 * - ACC: for construction documents (Fichas de Controlo, Evidências)
 * 
 * Usage:
 *   import { sendDocument } from "./integrations";
 *   await sendDocument({ type: "ficha", projectCode: "SIN02", fileName: "...", buffer: ... });
 */

import { uploadToSharePoint, isSharePointConfigured, getSharePointPath } from "./sharepoint";
import { uploadToACC, isACCConfigured } from "./acc";

export interface DocumentPayload {
  type: "ficha" | "rdcd" | "plano" | "mirr";
  projectCode: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}

export interface SendResult {
  sharepoint?: { success: boolean; url?: string; error?: string };
  acc?: { success: boolean; url?: string; error?: string };
}

/**
 * Send a document to the configured external storage(s)
 * - Fichas de Controlo → ACC (primary) + SharePoint (backup)
 * - RDCD, Planos, MIRR → SharePoint only
 */
export async function sendDocument(payload: DocumentPayload): Promise<SendResult> {
  const result: SendResult = {};

  // Always try SharePoint if configured
  if (isSharePointConfigured()) {
    const folderPath = getSharePointPath(payload.projectCode, payload.type);
    result.sharepoint = await uploadToSharePoint(
      folderPath,
      payload.fileName,
      payload.buffer,
      payload.contentType || "application/octet-stream"
    );
  }

  // For fichas, also send to ACC
  if (payload.type === "ficha" && isACCConfigured()) {
    result.acc = await uploadToACC(payload.fileName, payload.buffer);
  }

  return result;
}

/**
 * Get integration status for display in admin panel
 */
export function getIntegrationStatus() {
  return {
    sharepoint: {
      configured: isSharePointConfigured(),
      description: "Microsoft SharePoint — Armazenamento de documentos internos",
    },
    acc: {
      configured: isACCConfigured(),
      description: "Autodesk Construction Cloud — Fichas de controlo em obra",
    },
  };
}

export { isSharePointConfigured, isACCConfigured };

