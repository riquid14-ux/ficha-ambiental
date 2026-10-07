import type { Express } from "express";
import { Readable } from "node:stream";

import { storageGetSignedUrl } from "./storage";
import { isPublicBrandingKey, isSafeStorageKey } from "./storage-authorization";

/**
 * Only the explicitly public institutional-media allow-list is streamed here.
 * Private evidence, documents and report assets keep using their scoped routes.
 */
export function isPublicBrandImageKey(value: unknown): value is string {
  return typeof value === "string" && isSafeStorageKey(value) && isPublicBrandingKey(value);
}

/**
 * Streams approved institutional photography on the application origin.
 * This avoids relying on a browser following a signed cross-origin redirect,
 * which is unreliable behind some corporate proxies and browser policies.
 */
export function registerBrandMediaRoutes(app: Express) {
  app.get("/api/brand/media", async (req, res) => {
    const key = typeof req.query.key === "string" ? req.query.key : "";
    if (!isPublicBrandImageKey(key)) {
      res.status(404).send("Imagem institucional não encontrada.");
      return;
    }

    try {
      const signedUrl = await storageGetSignedUrl(key);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).send("Não foi possível obter a imagem institucional.");
        return;
      }

      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) {
        res.status(502).send("Tipo de imagem institucional inválido.");
        return;
      }

      res.status(200);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      console.error("[BrandMedia] Failed to stream institutional image", error);
      if (!res.headersSent) {
        res.status(502).send("Não foi possível obter a imagem institucional.");
      }
    }
  });
}
