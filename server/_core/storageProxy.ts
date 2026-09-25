import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { authorizeStorageRead, isPublicBrandingKey, isSafeStorageKey } from "../storage-authorization";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*key", async (req, res) => {
    const rawKey = req.params.key;
    const key = Array.isArray(rawKey) ? rawKey.join("/") : rawKey;
    if (typeof key !== "string" || !isSafeStorageKey(key)) {
      res.status(404).send("Recurso não encontrado.");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(503).send("Armazenamento indisponível.");
      return;
    }

    try {
      // A lista pública é deliberadamente exata e limitada aos ativos estáticos
      // de marca usados antes do login. Todo o restante conteúdo é privado.
      if (!isPublicBrandingKey(key)) {
        let user;
        try {
          user = await sdk.authenticateRequest(req);
        } catch {
          res.status(401).send("Autenticação necessária.");
          return;
        }
        if (!await authorizeStorageRead(user, key)) {
          // A resposta não revela se a chave existe nem a entidade proprietária.
          res.status(404).send("Recurso não encontrado.");
          return;
        }
      }

      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Não foi possível obter o ficheiro.");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Não foi possível obter o ficheiro.");
        return;
      }

      res.set("Cache-Control", "private, no-store, max-age=0");
      res.set("Pragma", "no-cache");
      res.set("X-Content-Type-Options", "nosniff");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Não foi possível obter o ficheiro.");
    }
  });
}
