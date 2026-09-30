import type { Express } from "express";
import { Readable } from "node:stream";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";
import * as db from "./db";

const DEFAULT_RDCD_LOGO_KEYS = new Set([
  "start-campus-rdcd_d271a631.png",
  "gleeds-rdcd_56c50b11.png",
  "quadrante-rdcd_c9e7bf7d.jpg",
]);

function typeForKey(key: string) {
  return key.endsWith(".png") ? "image/png" : "image/jpeg";
}

/**
 * Streams only the identity marks available to a report editor. It avoids
 * browser-to-cloud-storage redirects during client-side Word generation while
 * preserving per-project access for an uploaded custom mark.
 */
export function registerRdcdMediaRoutes(app: Express) {
  app.get("/api/rdcd/media/logo", async (req, res) => {
    const projectId = Number(req.query.projectId);
    const rawKey = typeof req.query.key === "string" ? req.query.key.replace(/^\/manus-storage\//, "") : "";
    if (!Number.isSafeInteger(projectId) || projectId < 1 || !rawKey || rawKey.length > 500 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(rawKey)) {
      res.status(400).send("Referência de logótipo inválida.");
      return;
    }

    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin" && user.role !== "dono_obra") {
        res.status(403).send("Sem acesso às marcas do RDCD.");
        return;
      }
      const project = await db.getProjectById(projectId);
      if (!project) {
        res.status(404).send("Projeto não encontrado.");
        return;
      }
      const customForProject = new RegExp(`^rdcd-branding/${projectId}/[A-Za-z0-9._-]+$`).test(rawKey);
      if (!DEFAULT_RDCD_LOGO_KEYS.has(rawKey) && !customForProject) {
        res.status(404).send("Logótipo não encontrado.");
        return;
      }
      const signedUrl = await storageGetSignedUrl(rawKey);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).send("Não foi possível obter o logótipo.");
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", typeForKey(rawKey));
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      console.error("[RDCD] Failed to stream report logo", error);
      if (!res.headersSent) res.status(403).send("Sem acesso ao logótipo.");
    }
  });
}
