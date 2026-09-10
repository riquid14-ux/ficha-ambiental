import type { Express } from "express";
import { Readable } from "node:stream";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";

export const DOCUMENT_LIBRARY_READER_ROLES = new Set(["admin", "dono_obra", "pm", "raa", "ee"]);

export function canReadDocumentLibrary(user: { role?: string } | null | undefined) {
  return Boolean(user?.role && DOCUMENT_LIBRARY_READER_ROLES.has(user.role));
}

function safeDownloadName(filename: string) {
  return filename.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "documento.pdf";
}

/**
 * Entrega um PDF sem devolver a chave de storage nem um URL S3 ao browser.
 * A autorização é reavaliada em cada consulta, inclusive quando o URL é partilhado.
 */
export function registerDocumentLibraryRoutes(app: Express) {
  app.get("/api/documentos/:id/pdf", async (req, res) => {
    const documentId = Number(req.params.id);
    if (!Number.isSafeInteger(documentId) || documentId < 1) {
      res.status(404).send("Documento não encontrado.");
      return;
    }

    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("Autenticação necessária.");
      return;
    }
    if (!canReadDocumentLibrary(user)) {
      res.status(403).send("Sem autorização para consultar documentação.");
      return;
    }

    const document = await db.getDocumentLibraryItemById(documentId);
    if (!document || (document.status !== "published" && user.role !== "admin")) {
      res.status(404).send("Documento não encontrado.");
      return;
    }

    try {
      const signedUrl = await storageGetSignedUrl(document.fileKey);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).send("Não foi possível obter o documento.");
        return;
      }
      const filename = safeDownloadName(document.filename);
      res.status(200);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      console.error("[DocumentLibrary] Failed to stream document", error);
      if (!res.headersSent) res.status(502).send("Não foi possível obter o documento.");
    }
  });
}
