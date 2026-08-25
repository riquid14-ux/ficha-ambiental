import PDFDocument from "pdfkit";
import { isWeeklyControlMeasureNumber } from "@shared/weekly-control";

export type WeeklyControlEvidence = {
  responseId: number;
  filename?: string | null;
  mimeType?: string | null;
  buffer?: Buffer | null;
};

export type WeeklyControlPdfInput = {
  submission: any;
  company: any;
  project?: any | null;
  reviewer?: any | null;
  sections: any[];
  measures: any[];
  responses: any[];
  evidence: WeeklyControlEvidence[];
  measureReviews?: any[];
  reviewComments?: any[];
  companyLogo?: Buffer | null;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const TABLE_X = 55;
const TABLE_WIDTH = 730;
const HEADER_Y = 35;
const HEADER_HEIGHT = 68;
const META_Y = 116;
const TABLE_HEADER_Y = 166;
const TABLE_HEADER_HEIGHT = 66;
const CONTENT_TOP = TABLE_HEADER_Y + TABLE_HEADER_HEIGHT + 12;
const CONTENT_BOTTOM = 508;
const FOOTER_Y = 518;

const COLUMN_WIDTHS = {
  number: 44,
  description: 302,
  responsible: 80,
  status: 80,
  evidence: 224,
};

const STATUS_KEYS = ["I", "C", "NC", "NA"] as const;

function formatDate(value?: string | number | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function submissionStatusLabel(status?: string): string {
  const labels: Record<string, string> = {
    submitted: "SUBMETIDA PARA REVISÃO",
    under_review: "EM REVISÃO",
    approved: "APROVADA",
    rejected: "REJEITADA",
  };
  return labels[status || ""] || "—";
}

function cleanMeasureDescription(value: unknown): string {
  return String(value ?? "").replace(/^Medida DCAPE\s*-\s*/i, "").trim();
}

function formatResponsible(value: unknown): string {
  return String(value ?? "—").replace(/\s*[|/]\s*/g, "\n").trim();
}

export function selectWeeklyControlMeasures(measures: any[]): any[] {
  return measures
    .filter((measure) => isWeeklyControlMeasureNumber(measure.number))
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0) || a.id - b.id);
}

function textHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
  font = "Helvetica",
): number {
  if (!text) return 0;
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap: 0.8 });
}

function takeTextForHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  maxHeight: number,
  fontSize: number,
  font = "Helvetica",
): [string, string] {
  const normalized = text.trim();
  if (!normalized) return ["", ""];
  if (textHeight(doc, normalized, width, fontSize, font) <= maxHeight) return [normalized, ""];

  const words = normalized.split(/\s+/);
  let low = 1;
  let high = words.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = words.slice(0, middle).join(" ");
    if (textHeight(doc, candidate, width, fontSize, font) <= maxHeight) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (best === 0) return [words[0], words.slice(1).join(" ")];
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function drawPageChrome(doc: PDFKit.PDFDocument, input: WeeklyControlPdfInput): void {
  const logoWidth = 156;
  const titleWidth = 418;
  const weekWidth = TABLE_WIDTH - logoWidth - titleWidth;
  const titleX = TABLE_X + logoWidth;
  const weekX = titleX + titleWidth;

  doc.save().lineWidth(0.75).strokeColor("#111827");
  doc.rect(TABLE_X, HEADER_Y, logoWidth, HEADER_HEIGHT).stroke();
  doc.rect(titleX, HEADER_Y, titleWidth, HEADER_HEIGHT).stroke();
  doc.rect(weekX, HEADER_Y, weekWidth, HEADER_HEIGHT).stroke();
  doc.moveTo(weekX, HEADER_Y + 51).lineTo(weekX + weekWidth, HEADER_Y + 51).stroke();

  if (input.companyLogo) {
    try {
      doc.image(input.companyLogo, TABLE_X + 8, HEADER_Y + 8, { fit: [logoWidth - 16, HEADER_HEIGHT - 16], align: "center", valign: "center" });
    } catch {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827")
        .text(input.company?.shortName || "EMPRESA", TABLE_X + 8, HEADER_Y + 27, { width: logoWidth - 16, align: "center" });
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827")
      .text(input.company?.shortName || "EMPRESA", TABLE_X + 8, HEADER_Y + 27, { width: logoWidth - 16, align: "center" });
  }

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827")
    .text("FICHA DE CONTROLO DE MEDIDAS DE GESTÃO", titleX + 8, HEADER_Y + 17, { width: titleWidth - 16, align: "center" })
    .text("AMBIENTAL SEMANAL", titleX + 8, HEADER_Y + 37, { width: titleWidth - 16, align: "center" });

  doc.font("Helvetica").fontSize(8.5)
    .text(`Semana Nº ${input.submission.weekNumber}`, weekX + 4, HEADER_Y + 6, { width: weekWidth - 8, align: "center" })
    .text(`${formatDate(input.submission.weekStartDate)} a ${formatDate(input.submission.weekEndDate)}`, weekX + 4, HEADER_Y + 25, { width: weekWidth - 8, align: "center" });
  doc.font("Helvetica-Bold").fontSize(7.5)
    .text(`REV.002 · ${submissionStatusLabel(input.submission.status)}`, weekX + 4, HEADER_Y + 55, { width: weekWidth - 8, align: "center" });

  const reviewerName = input.reviewer?.fullName || input.reviewer?.name || input.reviewer?.email || "—";
  const traceability = input.submission.status === "approved"
    ? `Empresa: ${input.company?.name || "—"} (${input.company?.shortName || "—"})  ·  Projeto: ${input.project?.code || "—"}  ·  Aprovada por: ${reviewerName} em ${formatDateTime(input.submission.reviewedAt)}`
    : `Empresa: ${input.company?.name || "—"} (${input.company?.shortName || "—"})  ·  Projeto: ${input.project?.code || "—"}  ·  Submetida em: ${formatDateTime(input.submission.submittedAt)}`;
  doc.font("Helvetica").fontSize(7.5).fillColor("#374151")
    .text(traceability, TABLE_X, META_Y, { width: TABLE_WIDTH, align: "left" });

  drawTableHeader(doc);

  doc.font("Helvetica").fontSize(7.2).fillColor("#111827")
    .text("I - Implementado; C – conforme; NC – não conforme; NA – não aplicável", TABLE_X + 14, FOOTER_Y, { width: TABLE_WIDTH - 28 })
    .text("MM – Medidas de Minimização da DCAPE relativa ao Projeto Start Campus Data Center SIN02; EE – Entidade Executante; DO – Dono de Obra; RAA – Responsável pelo Acompanhamento Ambiental; RAP – Responsável pelo Acompanhamento Patrimonial", TABLE_X + 14, FOOTER_Y + 13, { width: TABLE_WIDTH - 28 });
  doc.restore();
}

function drawTableHeader(doc: PDFKit.PDFDocument): void {
  const xNumber = TABLE_X;
  const xDescription = xNumber + COLUMN_WIDTHS.number;
  const xResponsible = xDescription + COLUMN_WIDTHS.description;
  const xStatus = xResponsible + COLUMN_WIDTHS.responsible;
  const xEvidence = xStatus + COLUMN_WIDTHS.status;
  const statusCellWidth = COLUMN_WIDTHS.status / 4;

  doc.save().lineWidth(0.7).strokeColor("#111827").fillColor("#111827");
  doc.rect(TABLE_X, TABLE_HEADER_Y, TABLE_WIDTH, TABLE_HEADER_HEIGHT).stroke();
  for (const x of [xDescription, xResponsible, xStatus, xEvidence]) {
    doc.moveTo(x, TABLE_HEADER_Y).lineTo(x, TABLE_HEADER_Y + TABLE_HEADER_HEIGHT).stroke();
  }
  const statusSplitY = TABLE_HEADER_Y + 43;
  doc.moveTo(xStatus, statusSplitY).lineTo(xEvidence, statusSplitY).stroke();
  for (let index = 1; index < 4; index += 1) {
    const x = xStatus + statusCellWidth * index;
    doc.moveTo(x, statusSplitY).lineTo(x, TABLE_HEADER_Y + TABLE_HEADER_HEIGHT).stroke();
  }

  doc.font("Helvetica-Bold").fontSize(8)
    .text("N.º", xNumber, TABLE_HEADER_Y + 27, { width: COLUMN_WIDTHS.number, align: "center" })
    .text("Medidas de Minimização", xDescription + 4, TABLE_HEADER_Y + 27, { width: COLUMN_WIDTHS.description - 8, align: "center" })
    .text("Responsável\npela\nimplementação", xResponsible + 3, TABLE_HEADER_Y + 10, { width: COLUMN_WIDTHS.responsible - 6, align: "center", lineGap: 0 })
    .text("Implementação", xStatus + 2, TABLE_HEADER_Y + 17, { width: COLUMN_WIDTHS.status - 4, align: "center" })
    .text("Observações / Evidências", xEvidence + 4, TABLE_HEADER_Y + 27, { width: COLUMN_WIDTHS.evidence - 8, align: "center" });

  STATUS_KEYS.forEach((status, index) => {
    doc.text(status, xStatus + statusCellWidth * index, statusSplitY + 7, { width: statusCellWidth, align: "center" });
  });
  doc.restore();
}

function drawSectionRow(doc: PDFKit.PDFDocument, y: number, text: string, strong: boolean): number {
  const height = strong ? 19 : 18;
  doc.save().lineWidth(0.65).strokeColor("#111827")
    .fillColor(strong ? "#b7b7b7" : "#d8d8d8")
    .rect(TABLE_X, y, TABLE_WIDTH, height).fillAndStroke();
  doc.fillColor("#111827").font(strong ? "Helvetica-Bold" : "Helvetica-BoldOblique").fontSize(strong ? 8.2 : 7.8)
    .text(text, TABLE_X + 6, y + (strong ? 5 : 4), { width: TABLE_WIDTH - 12, align: "center" });
  doc.restore();
  return y + height;
}

function buildEvidenceText(
  response: any | undefined,
  review: any | undefined,
  comments: any[],
  evidenceCount: number,
): string {
  const parts: string[] = [];
  if (response?.observations) parts.push(response.observations);
  if (review?.comment) parts.push(`Revisão RAA: ${review.comment}`);
  for (const comment of comments) {
    if (comment?.comment) parts.push(`Comentário: ${comment.comment}`);
  }
  if (evidenceCount > 0) parts.push(`Evidências anexadas: ${evidenceCount}`);
  return parts.join("\n");
}

function drawMeasureTextRow(
  doc: PDFKit.PDFDocument,
  y: number,
  rowHeight: number,
  measure: any,
  description: string,
  responsible: string,
  response: any | undefined,
  evidenceText: string,
  firstChunk: boolean,
): void {
  const xNumber = TABLE_X;
  const xDescription = xNumber + COLUMN_WIDTHS.number;
  const xResponsible = xDescription + COLUMN_WIDTHS.description;
  const xStatus = xResponsible + COLUMN_WIDTHS.responsible;
  const xEvidence = xStatus + COLUMN_WIDTHS.status;
  const statusCellWidth = COLUMN_WIDTHS.status / 4;

  doc.save().lineWidth(0.55).strokeColor("#111827").fillColor("#111827");
  doc.rect(TABLE_X, y, TABLE_WIDTH, rowHeight).stroke();
  for (const x of [xDescription, xResponsible, xStatus, xEvidence]) {
    doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
  }
  for (let index = 1; index < 4; index += 1) {
    const x = xStatus + statusCellWidth * index;
    doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
  }

  doc.font("Helvetica").fontSize(7.6)
    .text(firstChunk ? String(measure.number) : "", xNumber + 3, y + 6, { width: COLUMN_WIDTHS.number - 6, align: "center" })
    .text(description, xDescription + 5, y + 5, { width: COLUMN_WIDTHS.description - 10, align: "justify", lineGap: 0.8 })
    .text(firstChunk ? responsible : "", xResponsible + 3, y + 6, { width: COLUMN_WIDTHS.responsible - 6, align: "center", lineGap: 1 })
    .text(evidenceText, xEvidence + 5, y + 5, { width: COLUMN_WIDTHS.evidence - 10, align: "left", lineGap: 0.8 });

  if (firstChunk && response?.status && STATUS_KEYS.includes(response.status)) {
    const index = STATUS_KEYS.indexOf(response.status);
    doc.font("Helvetica-Bold").fontSize(10)
      .text("X", xStatus + statusCellWidth * index, y + Math.max(6, rowHeight / 2 - 5), { width: statusCellWidth, align: "center" });
  }
  doc.restore();
}

function drawEvidenceImageRow(
  doc: PDFKit.PDFDocument,
  y: number,
  measure: any,
  items: WeeklyControlEvidence[],
): number {
  const rowHeight = 88;
  const xDescription = TABLE_X + COLUMN_WIDTHS.number;
  const xResponsible = xDescription + COLUMN_WIDTHS.description;
  const xStatus = xResponsible + COLUMN_WIDTHS.responsible;
  const xEvidence = xStatus + COLUMN_WIDTHS.status;

  doc.save().lineWidth(0.55).strokeColor("#111827").fillColor("#111827");
  doc.rect(TABLE_X, y, TABLE_WIDTH, rowHeight).stroke();
  for (const x of [xDescription, xResponsible, xStatus, xEvidence]) {
    doc.moveTo(x, y).lineTo(x, y + rowHeight).stroke();
  }
  doc.font("Helvetica-Oblique").fontSize(7.2)
    .text(`Evidências da medida ${measure.number}`, xDescription + 5, y + 8, { width: COLUMN_WIDTHS.description - 10, align: "left" });

  const imageWidth = 96;
  items.slice(0, 2).forEach((item, index) => {
    const imageX = xEvidence + 6 + index * 108;
    if (item.buffer) {
      try {
        doc.image(item.buffer, imageX, y + 5, { fit: [imageWidth, 62], align: "center", valign: "center" });
      } catch {
        doc.font("Helvetica").fontSize(6.5).text("Pré-visualização indisponível", imageX, y + 30, { width: imageWidth, align: "center" });
      }
    } else {
      doc.font("Helvetica").fontSize(6.5).text("Pré-visualização indisponível", imageX, y + 30, { width: imageWidth, align: "center" });
    }
    doc.font("Helvetica").fontSize(5.8)
      .text(item.filename || "Evidência", imageX, y + 69, { width: imageWidth, align: "center", ellipsis: true });
  });
  doc.restore();
  return y + rowHeight;
}

function drawApprovalBlock(doc: PDFKit.PDFDocument, y: number, input: WeeklyControlPdfInput): number {
  const reviewerName = input.reviewer?.fullName || input.reviewer?.name || input.reviewer?.email || "—";
  const title = input.submission.status === "approved" ? "VALIDAÇÃO FINAL DA FICHA" : "SUBMISSÃO PARA REVISÃO";
  const detail = input.submission.status === "approved"
    ? `Estado: APROVADA  ·  Responsável pela revisão: ${reviewerName}  ·  Data: ${formatDateTime(input.submission.reviewedAt)}`
    : `Estado: ${submissionStatusLabel(input.submission.status)}  ·  Data: ${formatDateTime(input.submission.submittedAt)}`;
  const notes = input.submission.reviewNotes ? `Observações da revisão: ${input.submission.reviewNotes}` : "Sem observações gerais de revisão.";
  const blockHeight = Math.max(48, textHeight(doc, notes, TABLE_WIDTH - 18, 7.4) + 39);

  doc.save().lineWidth(0.65).strokeColor("#111827").fillColor("#d8d8d8")
    .rect(TABLE_X, y, TABLE_WIDTH, 18).fillAndStroke();
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8.2)
    .text(title, TABLE_X + 6, y + 5, { width: TABLE_WIDTH - 12, align: "center" });
  doc.fillColor("#ffffff").rect(TABLE_X, y + 18, TABLE_WIDTH, blockHeight - 18).fillAndStroke();
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7.4)
    .text(detail, TABLE_X + 8, y + 24, { width: TABLE_WIDTH - 16 });
  doc.font("Helvetica").fontSize(7.4)
    .text(notes, TABLE_X + 8, y + 37, { width: TABLE_WIDTH - 16, lineGap: 0.8 });
  doc.restore();
  return y + blockHeight;
}

export function generateWeeklyControlPdfBuffer(input: WeeklyControlPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
      info: {
        Title: `Ficha de Controlo de Medidas S${input.submission.weekNumber}/${input.submission.weekYear}`,
        Author: input.company?.name || "Plataforma de Gestão Ambiental — Start Campus",
        Subject: "Ficha de Controlo de Medidas de Gestão Ambiental Semanal",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let currentY = CONTENT_TOP;
    const addPage = () => {
      doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
      drawPageChrome(doc, input);
      currentY = CONTENT_TOP;
    };

    try {
      addPage();

      const measures = selectWeeklyControlMeasures(input.measures);
      const measureBySection = new Map<number, any[]>();
      for (const measure of measures) {
        const list = measureBySection.get(measure.sectionId) || [];
        list.push(measure);
        measureBySection.set(measure.sectionId, list);
      }

      const orderedSections = [...input.sections]
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0) || a.id - b.id);
      const weeklySections = orderedSections.filter((section) => (measureBySection.get(section.id) || []).length > 0);
      const responseMap = new Map(input.responses.map((response) => [response.measureId, response]));
      const reviewMap = new Map((input.measureReviews || []).map((review) => [review.measureId, review]));
      const commentsByMeasure = new Map<number, any[]>();
      for (const comment of input.reviewComments || []) {
        if (!comment.measureId) continue;
        const list = commentsByMeasure.get(comment.measureId) || [];
        list.push(comment);
        commentsByMeasure.set(comment.measureId, list);
      }
      const evidenceByResponse = new Map<number, WeeklyControlEvidence[]>();
      for (const item of input.evidence || []) {
        const list = evidenceByResponse.get(item.responseId) || [];
        list.push(item);
        evidenceByResponse.set(item.responseId, list);
      }

      let previousPhase = "";
      for (const section of weeklySections) {
        const sectionMeasures = measureBySection.get(section.id) || [];
        const phaseChanged = section.phase !== previousPhase;
        const phaseHeading = orderedSections.find((candidate) =>
          candidate.phase === section.phase
          && candidate.orderIndex <= section.orderIndex
          && (measureBySection.get(candidate.id) || []).length === 0,
        );
        const neededForHeadings = (phaseChanged ? 19 : 0) + 18;
        if (currentY + neededForHeadings > CONTENT_BOTTOM) addPage();
        if (phaseChanged) {
          currentY = drawSectionRow(doc, currentY, phaseHeading?.name || section.phase.toUpperCase(), true);
        }
        currentY = drawSectionRow(doc, currentY, section.name, false);
        previousPhase = section.phase;

        for (const measure of sectionMeasures) {
          const response = responseMap.get(measure.id);
          const evidenceItems = response ? evidenceByResponse.get(response.id) || [] : [];
          const evidenceText = buildEvidenceText(
            response,
            reviewMap.get(measure.id),
            commentsByMeasure.get(measure.id) || [],
            evidenceItems.length,
          );
          let descriptionRemaining = cleanMeasureDescription(measure.description);
          let evidenceRemaining = evidenceText;
          let firstChunk = true;

          do {
            if (CONTENT_BOTTOM - currentY < 30) addPage();
            const availableHeight = CONTENT_BOTTOM - currentY;
            const descriptionHeight = textHeight(doc, descriptionRemaining, COLUMN_WIDTHS.description - 10, 7.6);
            const evidenceHeight = textHeight(doc, evidenceRemaining, COLUMN_WIDTHS.evidence - 10, 7.6);
            const desiredHeight = Math.max(28, descriptionHeight + 10, evidenceHeight + 10);

            let descriptionPart = descriptionRemaining;
            let evidencePart = evidenceRemaining;
            let rowHeight = desiredHeight;
            if (desiredHeight > availableHeight) {
              const maxTextHeight = Math.max(18, availableHeight - 10);
              [descriptionPart, descriptionRemaining] = takeTextForHeight(
                doc, descriptionRemaining, COLUMN_WIDTHS.description - 10, maxTextHeight, 7.6,
              );
              [evidencePart, evidenceRemaining] = takeTextForHeight(
                doc, evidenceRemaining, COLUMN_WIDTHS.evidence - 10, maxTextHeight, 7.6,
              );
              rowHeight = availableHeight;
            } else {
              descriptionRemaining = "";
              evidenceRemaining = "";
            }

            drawMeasureTextRow(
              doc,
              currentY,
              rowHeight,
              measure,
              descriptionPart,
              formatResponsible(measure.responsible),
              response,
              evidencePart,
              firstChunk,
            );
            currentY += rowHeight;
            firstChunk = false;
            if (descriptionRemaining || evidenceRemaining) addPage();
          } while (descriptionRemaining || evidenceRemaining);

          for (let index = 0; index < evidenceItems.length; index += 2) {
            if (CONTENT_BOTTOM - currentY < 88) addPage();
            currentY = drawEvidenceImageRow(doc, currentY, measure, evidenceItems.slice(index, index + 2));
          }
        }
      }

      const approvalNotesHeight = input.submission.reviewNotes
        ? textHeight(doc, input.submission.reviewNotes, TABLE_WIDTH - 18, 7.4) + 39
        : 48;
      if (currentY + Math.max(48, approvalNotesHeight) > CONTENT_BOTTOM) addPage();
      currentY = drawApprovalBlock(doc, currentY, input);

      const range = doc.bufferedPageRange();
      for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        doc.font("Helvetica").fontSize(6.5).fillColor("#4b5563")
          .text(`Página ${index + 1} de ${range.count}`, TABLE_X, PAGE_HEIGHT - 17, { width: TABLE_WIDTH, align: "right" });
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
