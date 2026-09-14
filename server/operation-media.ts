import type { Express } from "express";
import { Readable } from "node:stream";
import { sdk } from "./_core/sdk";
import { assertOperationAccess } from "./routers";
import { storageGetSignedUrl } from "./storage";

const NEST_DRONE_IMAGE_KEY = "nest-infraestrutura-drone-source_b1083e17.webp";

/**
 * Entrega a fotografia do NEST no próprio domínio da aplicação, evitando que
 * o browser tenha de seguir um redirecionamento de storage durante o mapa.
 * O acesso é revalidado em cada pedido com a mesma política da área Operação.
 */
export function registerOperationMediaRoutes(app: Express) {
  app.get("/api/operacao/media/nest-drone", async (req, res) => {
    const projectId = Number(req.query.projectId);
    if (!Number.isSafeInteger(projectId) || projectId < 1) {
      res.status(400).send("Projeto de Operação inválido.");
      return;
    }

    let user;
    try {
      user = await sdk.authenticateRequest(req);
      await assertOperationAccess(user, projectId);
    } catch {
      res.status(403).send("Sem acesso à fotografia de infraestrutura.");
      return;
    }

    try {
      const signedUrl = await storageGetSignedUrl(NEST_DRONE_IMAGE_KEY);
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        res.status(502).send("Não foi possível obter a fotografia de infraestrutura.");
        return;
      }
      res.status(200);
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      Readable.fromWeb(upstream.body as never).pipe(res);
    } catch (error) {
      console.error("[OperationMedia] Failed to stream NEST drone image", error);
      if (!res.headersSent) res.status(502).send("Não foi possível obter a fotografia de infraestrutura.");
    }
  });
}
