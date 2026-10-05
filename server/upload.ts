import { Express, Request, Response } from "express";

/**
 * Legacy upload endpoint retained only to return a clear migration response.
 * Evidence ingestion is performed exclusively by the `files.upload` tRPC
 * procedure, which enforces project/module scope, measure ownership, content
 * validation, sanitisation and audit logging.
 */
export function registerUploadRoutes(app: Express) {
  app.post("/api/upload/evidence", (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Esta rota de upload foi desativada. Utilize o fluxo seguro de evidências da plataforma.",
    });
  });
}
