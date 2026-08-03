import { Express, Request, Response } from "express";
import { storagePut } from "./storage";
import { addEvidenceImage, getSubmissionById } from "./db";
import { sdk } from "./_core/sdk";

export function registerUploadRoutes(app: Express) {
  // Upload evidence image for a measure response
  app.post("/api/upload/evidence", async (req: Request, res: Response) => {
    try {
      // Authenticate
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Não autorizado" });
      }

      const { submissionId, measureId, filename, mimeType, data } = req.body;

      if (!submissionId || !measureId || !data) {
        return res.status(400).json({ error: "Campos obrigatórios em falta" });
      }

      // Verify submission belongs to user's company
      const sub = await getSubmissionById(submissionId);
      if (!sub) {
        return res.status(404).json({ error: "Submissão não encontrada" });
      }
      if (user.role !== "admin" && user.role !== "dono_obra" && sub.companyId !== user.companyId) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      // Decode base64 data
      const buffer = Buffer.from(data, "base64");
      const timestamp = new Date().toISOString().slice(0, 10);
      const ext = (filename || "image.jpg").split(".").pop() || "jpg";
      const fileKey = `evidence/${submissionId}/Medida${measureId}_${timestamp}.${ext}`;
      const contentType = mimeType || "image/jpeg";

      // Upload to S3
      const { key, url } = await storagePut(fileKey, buffer, contentType);

      // Find or create the measure response first
      const { upsertMeasureResponse } = await import("./db");
      const { id: responseId } = await upsertMeasureResponse({
        submissionId,
        measureId,
        status: null,
        observations: null,
      });

      // Save image record
      const result = await addEvidenceImage({
        responseId,
        fileKey: key,
        url,
        filename: filename || "image.jpg",
        mimeType: contentType,
      });

      return res.json({ id: result.id, url, fileKey: key });
    } catch (error: any) {
      console.error("[Upload] Error:", error);
      return res.status(500).json({ error: error.message || "Erro interno" });
    }
  });
}
