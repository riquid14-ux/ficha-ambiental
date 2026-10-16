import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";

import { authenticateLocalRequest } from "../auth/session";
import { storageGetSignedUrl } from "../storage";
import { authorizeStorageRead, isPublicBrandingKey, isSafeStorageKey } from "../storage-authorization";

function extractKey(value: unknown): string | null {
  const key = Array.isArray(value) ? value.join("/") : value;
  return typeof key === "string" && isSafeStorageKey(key) ? key : null;
}

async function streamObject(req: Request, res: Response) {
  const key = extractKey(req.params.key);
  if (!key) {
    res.status(404).send("Recurso não encontrado.");
    return;
  }

  if (!isPublicBrandingKey(key)) {
    let user;
    try {
      user = await authenticateLocalRequest(req);
    } catch {
      res.status(401).send("Autenticação necessária.");
      return;
    }
    if (!await authorizeStorageRead(user, key)) {
      res.status(404).send("Recurso não encontrado.");
      return;
    }
  }

  try {
    const signedUrl = await storageGetSignedUrl(key);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok || !upstream.body) {
      res.status(502).send("Não foi possível obter o ficheiro.");
      return;
    }
    res.status(200);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", isPublicBrandingKey(key) ? "public, max-age=86400" : "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    Readable.fromWeb(upstream.body as never).pipe(res);
  } catch (error) {
    console.error("[StorageProxy] Falha ao servir objeto", error instanceof Error ? error.message : error);
    if (!res.headersSent) res.status(502).send("Não foi possível obter o ficheiro.");
  }
}

/** Mantém o caminho legado enquanto o novo caminho deixa explícita a abstração S3. */
export function registerStorageProxy(app: Express) {
  app.get("/api/storage/object/*key", streamObject);
  app.get("/manus-storage/*key", streamObject);
}
