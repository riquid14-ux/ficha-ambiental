import { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import https from "https";
import http from "http";
import { sdk } from "./_core/sdk";
import * as db from "./db";

// Helper to fetch image buffer from URL
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    return await new Promise((resolve) => {
      const client = url.startsWith("https") ? https : http;
      client.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      }).on("error", () => resolve(null));
    });
  } catch { return null; }
}

export function registerPdfRoutes(app: Express) {
  // Generate PDF report for a submission
  app.get("/api/pdf/submission/:id", async (req: Request, res: Response) => {
    try {
      // Authenticate
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Não autorizado" });
      }

      const submissionId = parseInt(req.params.id);
      if (isNaN(submissionId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const sub = await db.getSubmissionById(submissionId);
      if (!sub) {
        return res.status(404).json({ error: "Submissão não encontrada" });
      }

      // Access control
      if (user.role !== "admin" && sub.companyId !== user.companyId) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      // Get all data
      const company = await db.getCompanyById(sub.companyId);
      const sections = await db.getAllSections();
      const measures = await db.getAllMeasures();
      const responses = await db.getResponsesBySubmission(submissionId);
      const images = await db.getImagesBySubmission(submissionId);

      // Build response map
      const responseMap = new Map(responses.map((r) => [r.measureId, r]));
      const imageMap = new Map<number, typeof images>();
      for (const img of images) {
        const list = imageMap.get(img.responseId) || [];
        list.push(img);
        imageMap.set(img.responseId, list);
      }

      // Generate PDF
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ficha_ambiental_S${sub.weekNumber}_${sub.weekYear}_${company?.shortName || "EE"}.pdf"`
      );

      doc.pipe(res);

      // ─── Header ───
      doc.fontSize(18).font("Helvetica-Bold").text("FICHA DE CONTROLO DE MEDIDAS", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text("Acompanhamento Ambiental de Obra", { align: "center" });
      doc.moveDown(1);

      // ─── Meta info ───
      doc.fontSize(10).font("Helvetica-Bold").text("Informações da Submissão", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Empresa: ${company?.name || "-"} (${company?.shortName || "-"})`);
      doc.text(`Semana: ${sub.weekNumber} / ${sub.weekYear}`);
      doc.text(`Período: ${sub.weekStartDate} a ${sub.weekEndDate}`);
      doc.text(`Estado: ${sub.status === "submitted" ? "Submetida" : "Rascunho"}`);
      if (sub.submittedAt) {
        doc.text(`Data de submissão: ${new Date(sub.submittedAt).toLocaleString("pt-PT")}`);
      }
      doc.moveDown(1);

      // ─── Measures by section ───
      for (const section of sections) {
        const sectionMeasures = measures.filter((m) => m.sectionId === section.id);
        if (sectionMeasures.length === 0) continue;

        // Section header
        doc.addPage();
        doc.fontSize(12).font("Helvetica-Bold").text(`${section.phase} — ${section.name}`, { underline: true });
        doc.moveDown(0.5);

        for (const measure of sectionMeasures) {
          const response = responseMap.get(measure.id);
          const status = response?.status || "-";
          const obs = response?.observations || "";

          // Check if we need a new page
          if (doc.y > 700) doc.addPage();

          // Measure row
          doc.fontSize(9).font("Helvetica-Bold").text(`${measure.number}`, { continued: true });
          doc.font("Helvetica").text(` — ${measure.description.substring(0, 80)}${measure.description.length > 80 ? "..." : ""}`, { continued: true });

          // Status badge
          const statusColors: Record<string, string> = { I: "#22c55e", C: "#3b82f6", NC: "#ef4444", NA: "#6b7280" };
          doc.font("Helvetica-Bold").fillColor(statusColors[status] || "#000000").text(`  [${status}]`);
          doc.fillColor("#000000");

          if (obs) {
            doc.fontSize(8).font("Helvetica-Oblique").text(`   Obs: ${obs}`, { indent: 20 });
          }

          // Images reference
          if (response) {
            const responseImages = imageMap.get(response.id);
            if (responseImages && responseImages.length > 0) {
              doc.fontSize(8).font("Helvetica").text(`   Evidências (${responseImages.length}):`, { indent: 20 });
              for (const img of responseImages) {
                try {
                  if (doc.y > 580) doc.addPage();
                  const imgBuffer = await fetchImageBuffer(img.url);
                  if (imgBuffer) {
                    doc.image(imgBuffer, doc.x + 30, doc.y + 5, { fit: [180, 130] });
                    doc.moveDown(7.5);
                  }
                } catch { /* skip failed images */ }
              }
            }
          }

          doc.moveDown(0.3);
        }
      }

      // ─── Summary ───
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Resumo", { underline: true });
      doc.moveDown(0.5);

      const statusCounts = { I: 0, C: 0, NC: 0, NA: 0, pending: 0 };
      for (const m of measures) {
        const r = responseMap.get(m.id);
        if (r?.status && r.status in statusCounts) {
          statusCounts[r.status as keyof typeof statusCounts]++;
        } else {
          statusCounts.pending++;
        }
      }

      doc.fontSize(10).font("Helvetica");
      doc.text(`Total de medidas: ${measures.length}`);
      doc.text(`Implementado (I): ${statusCounts.I}`);
      doc.text(`Conforme (C): ${statusCounts.C}`);
      doc.text(`Não Conforme (NC): ${statusCounts.NC}`);
      doc.text(`Não Aplicável (NA): ${statusCounts.NA}`);
      doc.text(`Pendentes: ${statusCounts.pending}`);

      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica").text(`Gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`, { align: "center" });

      doc.end();
    } catch (error: any) {
      console.error("[PDF] Error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Erro ao gerar PDF" });
      }
    }
  });

  // Batch PDF export - returns a ZIP of multiple PDFs
  app.get("/api/pdf/batch", async (req: Request, res: Response) => {
    try {
      // Authenticate
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Não autorizado" });
      }

      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.status(400).json({ error: "Parâmetro 'ids' é obrigatório" });
      }

      const ids = idsParam.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
      if (ids.length === 0) {
        return res.status(400).json({ error: "Nenhum ID válido fornecido" });
      }

      if (ids.length > 50) {
        return res.status(400).json({ error: "Máximo de 50 fichas por exportação" });
      }

      // Set response headers for ZIP
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="fichas_ambientais.zip"`);

      // Create ZIP archive
      const archive = new ZipArchive({ zlib: { level: 5 } });
      archive.pipe(res);

      archive.on("error", (err: any) => {
        console.error("[PDF Batch] Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Erro ao criar arquivo ZIP" });
        }
      });

      // Pre-fetch shared data
      const sections = await db.getAllSections();
      const measures = await db.getAllMeasures();

      for (const submissionId of ids) {
        try {
          const sub = await db.getSubmissionById(submissionId);
          if (!sub) continue;

          // Access control: skip submissions user can't access
          if (user.role !== "admin" && user.role !== "dono_obra" && user.role !== "raa" && user.role !== "observador") {
            if (sub.companyId !== user.companyId) continue;
          }

          // Only export submitted or approved
          if (sub.status !== "submitted" && sub.status !== "approved") continue;

          const company = await db.getCompanyById(sub.companyId);
          const responses = await db.getResponsesBySubmission(submissionId);
          const images = await db.getImagesBySubmission(submissionId);

          const responseMap = new Map(responses.map((r) => [r.measureId, r]));
          const imageMap = new Map<number, typeof images>();
          for (const img of images) {
            const list = imageMap.get(img.responseId) || [];
            list.push(img);
            imageMap.set(img.responseId, list);
          }

          // Generate PDF into buffer
          const pdfBuffer = await generatePdfBuffer(sub, company, sections, measures, responseMap, imageMap);

          const filename = `ficha_S${String(sub.weekNumber).padStart(2, "0")}_${sub.weekYear}_${company?.shortName || "EE"}.pdf`;
          archive.append(pdfBuffer, { name: filename });
        } catch (err) {
          console.error(`[PDF Batch] Error generating PDF for submission ${submissionId}:`, err);
          // Skip failed PDFs, continue with others
        }
      }

      await archive.finalize();
    } catch (error: any) {
      console.error("[PDF Batch] Error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Erro ao gerar ZIP de PDFs" });
      }
    }
  });
}

// Helper: Generate a PDF for a submission and return as Buffer
async function generatePdfBuffer(
  sub: any,
  company: any,
  sections: any[],
  measures: any[],
  responseMap: Map<number, any>,
  imageMap: Map<number, any[]>
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ─── Header ───
      doc.fontSize(18).font("Helvetica-Bold").text("FICHA DE CONTROLO DE MEDIDAS", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text("Acompanhamento Ambiental de Obra", { align: "center" });
      doc.moveDown(1);

      // ─── Meta info ───
      doc.fontSize(10).font("Helvetica-Bold").text("Informações da Submissão", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Empresa: ${company?.name || "-"} (${company?.shortName || "-"})`);
      doc.text(`Semana: ${sub.weekNumber} / ${sub.weekYear}`);
      doc.text(`Período: ${sub.weekStartDate} a ${sub.weekEndDate}`);
      doc.text(`Estado: ${sub.status === "approved" ? "Aprovada" : sub.status === "submitted" ? "Submetida" : sub.status}`);
      if (sub.submittedAt) {
        doc.text(`Data de submissão: ${new Date(sub.submittedAt).toLocaleString("pt-PT")}`);
      }
      doc.moveDown(1);

      // ─── Measures by section ───
      for (const section of sections) {
        const sectionMeasures = measures.filter((m) => m.sectionId === section.id);
        if (sectionMeasures.length === 0) continue;

        doc.addPage();
        doc.fontSize(12).font("Helvetica-Bold").text(`${section.phase} — ${section.name}`, { underline: true });
        doc.moveDown(0.5);

        for (const measure of sectionMeasures) {
          const response = responseMap.get(measure.id);
          const status = response?.status || "-";
          const obs = response?.observations || "";

          if (doc.y > 700) doc.addPage();

          doc.fontSize(9).font("Helvetica-Bold").text(`${measure.number}`, { continued: true });
          doc.font("Helvetica").text(` — ${measure.description.substring(0, 80)}${measure.description.length > 80 ? "..." : ""}`, { continued: true });

          const statusColors: Record<string, string> = { I: "#22c55e", C: "#3b82f6", NC: "#ef4444", NA: "#6b7280" };
          doc.font("Helvetica-Bold").fillColor(statusColors[status] || "#000000").text(`  [${status}]`);
          doc.fillColor("#000000");

          if (obs) {
            doc.fontSize(8).font("Helvetica-Oblique").text(`   Obs: ${obs}`, { indent: 20 });
          }

          // Images
          if (response) {
            const responseImages = imageMap.get(response.id);
            if (responseImages && responseImages.length > 0) {
              doc.fontSize(8).font("Helvetica").text(`   Evidências (${responseImages.length}):`, { indent: 20 });
              for (const img of responseImages) {
                try {
                  if (doc.y > 580) doc.addPage();
                  const imgBuffer = await fetchImageBuffer(img.url);
                  if (imgBuffer) {
                    doc.image(imgBuffer, doc.x + 30, doc.y + 5, { fit: [180, 130] });
                    doc.moveDown(7.5);
                  }
                } catch { /* skip */ }
              }
            }
          }

          doc.moveDown(0.3);
        }
      }

      // ─── Summary ───
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Resumo", { underline: true });
      doc.moveDown(0.5);

      const statusCounts = { I: 0, C: 0, NC: 0, NA: 0, pending: 0 };
      for (const m of measures) {
        const r = responseMap.get(m.id);
        if (r?.status && r.status in statusCounts) {
          statusCounts[r.status as keyof typeof statusCounts]++;
        } else {
          statusCounts.pending++;
        }
      }

      doc.fontSize(10).font("Helvetica");
      doc.text(`Total de medidas: ${measures.length}`);
      doc.text(`Implementado (I): ${statusCounts.I}`);
      doc.text(`Conforme (C): ${statusCounts.C}`);
      doc.text(`Não Conforme (NC): ${statusCounts.NC}`);
      doc.text(`Não Aplicável (NA): ${statusCounts.NA}`);
      doc.text(`Pendentes: ${statusCounts.pending}`);

      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica").text(`Gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`, { align: "center" });

      doc.end();
    } catch (err: any) {
      reject(err);
    }
  });
}
