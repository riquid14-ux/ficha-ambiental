import { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import https from "https";
import http from "http";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { generateWeeklyControlPdfBuffer } from "./weekly-control-pdf";

// Helper: determine which measures a user can export based on their role
// Admin, RAA, dono_obra, observador → all measures
// EE → only measures with "EE" in responsible
// RAP → only measures with "RAP" in responsible
function filterMeasuresForUser(measures: any[], user: any): any[] {
  const role = user.role;
  // Full access roles
  if (role === "admin" || role === "raa" || role === "dono_obra" || role === "observador") {
    return measures;
  }
  // RAP role
  if (role === "rap") {
    return measures.filter((m: any) => m.responsible.toUpperCase().includes("RAP"));
  }
  // EE and all others → only EE measures
  return measures.filter((m: any) => m.responsible.toUpperCase().includes("EE"));
}

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

async function buildWeeklyControlPdf(
  sub: any,
  company: any,
  sections: any[],
  measures: any[],
): Promise<Buffer> {
  const [responses, images, measureReviews, reviewComments, project, reviewer, companyLogo] = await Promise.all([
    db.getResponsesBySubmission(sub.id),
    db.getImagesBySubmission(sub.id),
    db.getMeasureReviewsBySubmission(sub.id),
    db.getCommentsBySubmission(sub.id),
    sub.projectId ? db.getProjectById(sub.projectId) : Promise.resolve(null),
    sub.reviewedBy ? db.getUserById(sub.reviewedBy) : Promise.resolve(null),
    company?.logoUrl ? fetchImageBuffer(company.logoUrl) : Promise.resolve(null),
  ]);

  const evidence = await Promise.all(images.map(async (image) => ({
    responseId: image.responseId,
    filename: image.filename,
    mimeType: image.mimeType,
    buffer: await fetchImageBuffer(image.url),
  })));

  return generateWeeklyControlPdfBuffer({
    submission: sub,
    company,
    project,
    reviewer,
    sections,
    measures,
    responses,
    evidence,
    measureReviews,
    reviewComments,
    companyLogo,
  });
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

      const submissionId = parseInt(String(req.params.id), 10);
      if (isNaN(submissionId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const sub = await db.getSubmissionById(submissionId);
      if (!sub) {
        return res.status(404).json({ error: "Submissão não encontrada" });
      }

      // Access control
      if (user.role !== "admin" && user.role !== "dono_obra" && user.role !== "raa" && user.role !== "observador" && sub.companyId !== user.companyId) {
        return res.status(403).json({ error: "Sem permissão" });
      }

      if (sub.status !== "submitted" && sub.status !== "approved") {
        return res.status(409).json({ error: "O PDF formal só pode ser gerado após submissão ou aprovação da ficha." });
      }

      const formalCompany = await db.getCompanyById(sub.companyId);
      const formalSections = await db.getAllSections();
      const formalMeasures = await db.getAllMeasures();
      const formalPdfBuffer = await buildWeeklyControlPdf(sub, formalCompany, formalSections, formalMeasures);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ficha_controlo_S${String(sub.weekNumber).padStart(2, "0")}_${sub.weekYear}_${formalCompany?.shortName || "EE"}_${sub.status === "approved" ? "APROVADA" : "SUBMETIDA"}.pdf"`,
      );
      return res.end(formalPdfBuffer);

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
          const pdfBuffer = await buildWeeklyControlPdf(sub, company, sections, measures);

          const filename = `ficha_controlo_S${String(sub.weekNumber).padStart(2, "0")}_${sub.weekYear}_${company?.shortName || "EE"}_${sub.status === "approved" ? "APROVADA" : "SUBMETIDA"}.pdf`;
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

  // ─── Per-Measure PDF Export ───
  // Generates a PDF showing the evolution of a specific measure (or multiple) over a period
  // Query params: measureIds (comma-separated), startDate, endDate, status (optional filter)
  app.get("/api/pdf/measure", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Não autorizado" });
      }

      const measureIdsParam = req.query.measureIds as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const statusFilter = req.query.status as string | undefined; // I, C, NC, NA

      if (!measureIdsParam || !startDate || !endDate) {
        return res.status(400).json({ error: "Parâmetros measureIds, startDate e endDate são obrigatórios" });
      }

      const measureIds = measureIdsParam.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
      if (measureIds.length === 0) {
        return res.status(400).json({ error: "Nenhum ID de medida válido" });
      }

      const database = await db.getDb();
      if (!database) {
        return res.status(500).json({ error: "Base de dados indisponível" });
      }

      // Get the measures info
      const allMeasures = await db.getAllMeasures();
      // Filter measures by user role first, then by requested IDs
      const allowedMeasures = filterMeasuresForUser(allMeasures, user);
      const allowedIds = new Set(allowedMeasures.map((m: any) => m.id));
      const selectedMeasures = allMeasures.filter((m) => measureIds.includes(m.id) && allowedIds.has(m.id));
      if (selectedMeasures.length === 0) {
        return res.status(403).json({ error: "Sem permissão para exportar as medidas selecionadas" });
      }

      const allSections = await db.getAllSections();

      // Get all submissions in the date range (approved or submitted)
      const { weeklySubmissions: wsTbl, measureResponses: mrTbl, evidenceImages: eiTbl } = await import("../drizzle/schema");
      const { and, gte, lte, inArray, eq } = await import("drizzle-orm");

      // Build query conditions
      const conditions: any[] = [
        gte(wsTbl.weekStartDate, startDate),
        lte(wsTbl.weekEndDate, endDate),
        inArray(wsTbl.status, ["submitted", "approved"]),
      ];

      // EE/RAP can only see their own company's submissions
      const isFullAccess = user.role === "admin" || user.role === "raa" || user.role === "dono_obra" || user.role === "observador";
      if (!isFullAccess && user.companyId) {
        conditions.push(eq(wsTbl.companyId, user.companyId));
      }

      const submissions = await database
        .select()
        .from(wsTbl)
        .where(and(...conditions))
        .orderBy(wsTbl.weekYear, wsTbl.weekNumber);

      if (submissions.length === 0) {
        return res.status(404).json({ error: "Nenhuma submissão encontrada no período" });
      }

      // For each measure, collect weekly data
      type WeekEntry = {
        weekNumber: number;
        weekYear: number;
        weekStartDate: string;
        weekEndDate: string;
        companyName: string;
        status: string | null;
        observations: string | null;
        images: { url: string; filename: string | null }[];
      };

      const measureData: Map<number, WeekEntry[]> = new Map();

      for (const measure of selectedMeasures) {
        const entries: WeekEntry[] = [];

        for (const sub of submissions) {
          // Get response for this measure in this submission
          const responses = await database
            .select()
            .from(mrTbl)
            .where(and(eq(mrTbl.submissionId, sub.id), eq(mrTbl.measureId, measure.id)));

          const response = responses[0];

          // Apply status filter if specified
          if (statusFilter && response?.status !== statusFilter) continue;

          // Get images for this response
          let images: { url: string; filename: string | null }[] = [];
          if (response) {
            const imgs = await database
              .select()
              .from(eiTbl)
              .where(eq(eiTbl.responseId, response.id));
            images = imgs.map((img) => ({ url: img.url, filename: img.filename }));
          }

          const company = await db.getCompanyById(sub.companyId);

          entries.push({
            weekNumber: sub.weekNumber,
            weekYear: sub.weekYear,
            weekStartDate: sub.weekStartDate,
            weekEndDate: sub.weekEndDate,
            companyName: company?.name || "-",
            status: response?.status || null,
            observations: response?.observations || null,
            images,
          });
        }

        if (entries.length > 0) {
          measureData.set(measure.id, entries);
        }
      }

      // Generate PDF
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      const filename = measureIds.length === 1
        ? `medida_${selectedMeasures[0]?.number || measureIds[0]}_evolucao.pdf`
        : `medidas_evolucao_${startDate}_${endDate}.pdf`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      doc.pipe(res);

      // ─── Header ───
      doc.fontSize(16).font("Helvetica-Bold").text("EVOLUÇÃO DE MEDIDA(S)", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text("Acompanhamento Ambiental de Obra — Relatório por Medida", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").text(`Período: ${startDate} a ${endDate}`, { align: "center" });
      if (statusFilter) {
        const statusLabels: Record<string, string> = { I: "Implementado", C: "Conforme", NC: "Não Conforme", NA: "Não Aplicável" };
        doc.text(`Filtro de estado: ${statusLabels[statusFilter] || statusFilter}`, { align: "center" });
      }
      doc.moveDown(1.5);

      // ─── For each measure ───
      for (const measure of selectedMeasures) {
        const entries = measureData.get(measure.id);
        if (!entries || entries.length === 0) continue;

        const section = allSections.find((s) => s.id === measure.sectionId);

        // Measure header
        if (doc.y > 100) doc.addPage();
        doc.fontSize(12).font("Helvetica-Bold").text(`Medida ${measure.number}`, { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(9).font("Helvetica").text(measure.description);
        doc.moveDown(0.2);
        doc.fontSize(8).font("Helvetica-Oblique").text(`Secção: ${section?.name || "-"} | Responsável: ${measure.responsible}`);
        doc.moveDown(0.5);

        // Status summary
        const statusCounts = { I: 0, C: 0, NC: 0, NA: 0, none: 0 };
        for (const e of entries) {
          if (e.status && e.status in statusCounts) statusCounts[e.status as keyof typeof statusCounts]++;
          else statusCounts.none++;
        }
        doc.fontSize(8).font("Helvetica-Bold").text(
          `Resumo: ${entries.length} semana(s) — I:${statusCounts.I} C:${statusCounts.C} NC:${statusCounts.NC} NA:${statusCounts.NA}`
        );
        doc.moveDown(0.5);

        // Weekly entries
        for (const entry of entries) {
          if (doc.y > 650) doc.addPage();

          // Week header
          doc.fontSize(9).font("Helvetica-Bold").text(
            `Semana ${entry.weekNumber}/${entry.weekYear} (${entry.weekStartDate} — ${entry.weekEndDate})`,
            { continued: true }
          );

          // Status badge
          const statusColors: Record<string, string> = { I: "#22c55e", C: "#3b82f6", NC: "#ef4444", NA: "#6b7280" };
          const statusLabels: Record<string, string> = { I: "Implementado", C: "Conforme", NC: "Não Conforme", NA: "N/A" };
          const st = entry.status || "-";
          doc.font("Helvetica-Bold").fillColor(statusColors[st] || "#000000").text(`  [${statusLabels[st] || st}]`);
          doc.fillColor("#000000");

          // Company
          doc.fontSize(8).font("Helvetica").text(`   Empresa: ${entry.companyName}`, { indent: 10 });

          // Observations
          if (entry.observations) {
            doc.fontSize(8).font("Helvetica-Oblique").text(`   Observações: ${entry.observations}`, { indent: 10 });
          }

          // Images
          if (entry.images.length > 0) {
            doc.fontSize(8).font("Helvetica").text(`   Evidências (${entry.images.length}):`, { indent: 10 });
            for (const img of entry.images) {
              try {
                if (doc.y > 560) doc.addPage();
                const imgBuffer = await fetchImageBuffer(img.url);
                if (imgBuffer) {
                  doc.image(imgBuffer, doc.x + 20, doc.y + 5, { fit: [200, 150] });
                  doc.moveDown(9);
                  if (img.filename) {
                    doc.fontSize(7).font("Helvetica").text(`      ${img.filename}`, { indent: 20 });
                  }
                }
              } catch { /* skip failed images */ }
            }
          }

          doc.moveDown(0.5);
          // Separator line
          doc.moveTo(doc.x, doc.y).lineTo(doc.x + 495, doc.y).strokeColor("#e5e7eb").stroke();
          doc.moveDown(0.3);
        }

        doc.moveDown(1);
      }

      // Footer
      doc.moveDown(1);
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280").text(
        `Gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`,
        { align: "center" }
      );

      doc.end();
    } catch (error: any) {
      console.error("[PDF Measure] Error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Erro ao gerar PDF por medida" });
      }
    }
  });
}
