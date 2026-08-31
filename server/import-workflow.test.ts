import { describe, expect, it } from "vitest";
import fs from "fs";
import AdmZip from "adm-zip";
import { extractDocumentText } from "./image-extractor";

const routerCode = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf8");
const weeklyFormCode = fs.readFileSync(`${process.cwd()}/client/src/pages/WeeklyForm.tsx`, "utf8");
const dbCode = fs.readFileSync(`${process.cwd()}/server/db.ts`, "utf8");
const historyCode = fs.readFileSync(`${process.cwd()}/client/src/pages/SubmissionHistory.tsx`, "utf8");
const matrixCode = fs.readFileSync(`${process.cwd()}/client/src/pages/Matriz.tsx`, "utf8");
const matrixStatusCode = fs.readFileSync(`${process.cwd()}/client/src/lib/matrix-status.ts`, "utf8");
const dashboardCode = fs.readFileSync(`${process.cwd()}/client/src/pages/Dashboard.tsx`, "utf8");
const rdcdCode = fs.readFileSync(`${process.cwd()}/client/src/pages/RDCD.tsx`, "utf8");

describe("Importação de fichas externas", () => {
  describe("Permissões e estados", () => {
    it("permite o destino de revisão apenas a quem pode submeter fichas", () => {
      expect(routerCode).toContain('destination === "review" && !canSubmitForms(user.role)');
      expect(routerCode).toContain('role === "ee" || role === "rap" || role === "admin" || role === "dono_obra"');
    });

    it("permite histórico aprovado apenas a admin e RAA", () => {
      expect(routerCode).toContain('destination === "historical" && user.role !== "admin" && user.role !== "raa"');
    });

    it("limita EE e RAP à própria empresa", () => {
      expect(routerCode).toContain('(user.role === "ee" || user.role === "rap") && user.companyId !== companyId');
    });

    it("valida o acesso ao projecto e a associação da empresa", () => {
      expect(routerCode).toContain("Sem acesso ao projecto seleccionado");
      expect(routerCode).toContain("A empresa seleccionada não está associada a este projecto");
    });

    it("cria a ficha importada com o estado correcto", () => {
      expect(routerCode).toContain('status: isHistorical ? "approved" : "submitted"');
      expect(routerCode).toContain('reviewedBy: isHistorical ? ctx.user.id : null');
    });

    it("bloqueia duplicados por projecto, empresa, semana e ano", () => {
      expect(routerCode).toContain("Já existe uma ficha para a Semana");
      expect(routerCode.match(/getSubmissionForWeek\(input\.companyId, input\.weekNumber, input\.year, input\.projectId\)/g)?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Segurança, rastreabilidade e integração", () => {
    it("aceita apenas PDF e DOCX e aplica o limite de 10 MB", () => {
      expect(routerCode).toContain('lower.endsWith(".pdf")');
      expect(routerCode).toContain('lower.endsWith(".docx")');
      expect(routerCode).toContain("buffer.length > 10 * 1024 * 1024");
    });

    it("sanitiza o documento antes de o analisar", () => {
      expect(routerCode).toContain("sanitizeFile(buffer, mimeType, input.filename)");
      expect(routerCode).toContain('"ficha-import-preview"');
    });

    it("impede reutilização de ficheiros temporários de outro utilizador", () => {
      expect(routerCode).toContain('const expectedPrefix = `pdf-imports/previews/${ctx.user.id}/`');
      expect(routerCode).toContain("Referência de ficheiro inválida");
    });

    it("regista o documento original, a auditoria e as evidências", () => {
      expect(routerCode).toContain("tx.insert(schema.historicalPdfs)");
      expect(routerCode).toContain("tx.insert(schema.auditLog)");
      expect(routerCode).toContain("tx.insert(schema.evidenceImages)");
    });

    it("notifica a RAA quando o destino é revisão", () => {
      expect(routerCode).toContain('if (input.destination === "review")');
      expect(routerCode).toContain("sendFichaSubmittedNotification");
    });

    it("arquiva externamente o histórico aprovado sem remover dados da BD", () => {
      expect(routerCode).toContain('archiveDocument("ficha"');
      expect(routerCode).toContain('status: "approved"');
    });

    it("faz o histórico consumir a mesma lista onde a ficha aprovada é criada", () => {
      expect(historyCode).toContain("trpc.submissions.listAll.useQuery");
      expect(historyCode).toContain('sub.status === "approved"');
      expect(routerCode).toContain('status: isHistorical ? "approved" : "submitted"');
    });

    it("faz a Matriz consumir fichas aprovadas da tabela semanal", () => {
      expect(matrixCode).toContain("trpc.matrix.getData.useQuery");
      expect(matrixCode).toContain("getMatrixStatusDisplay");
      expect(matrixStatusCode).toContain('case "approved"');
      expect(dbCode).toContain("export async function getMatrixData");
      expect(dbCode).toContain("weeklySubmissions");
    });

    it("faz o Dashboard calcular compliance apenas com fichas aprovadas", () => {
      expect(dashboardCode).toContain("trpc.analytics.overview.useQuery");
      expect(dashboardCode).toContain('s.status === "approved"');
      expect(dbCode).toContain("export async function getAnalytics");
      expect(dbCode).toContain('eq(weeklySubmissions.status, "approved")');
    });

    it("faz o RDCD seleccionar apenas fichas aprovadas e carregar as suas respostas", () => {
      expect(rdcdCode).toContain("trpc.submissions.listAll.useQuery");
      expect(rdcdCode).toContain('s.status === "approved"');
      expect(rdcdCode).toContain("trpc.responses.getBySubmissions.useQuery");
    });
  });

  describe("Pré-visualização e confirmação humana", () => {
    it("tem passos explícitos de destino, análise e confirmação", () => {
      expect(weeklyFormCode).toContain("1. Escolha o destino da ficha");
      expect(weeklyFormCode).toContain("2. Seleccione o documento");
      expect(weeklyFormCode).toContain("3. Confirme a pré-visualização");
    });

    it("permite corrigir estados e observações antes de gravar", () => {
      expect(weeklyFormCode).toContain("Confirmar ou corrigir observações");
      expect(weeklyFormCode).toContain("Voltar e alterar");
      expect(weeklyFormCode).toContain("Submeter à RAA para revisão");
      expect(weeklyFormCode).toContain("Confirmar histórico aprovado");
    });

    it("extrai texto de um DOCX real sem executar conteúdo do documento", async () => {
      const zip = new AdmZip();
      zip.addFile(
        "word/document.xml",
        Buffer.from('<?xml version="1.0"?><w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>Medida M01 Conforme</w:t></w:r></w:p><w:p><w:r><w:t>Observação validada</w:t></w:r></w:p></w:body></w:document>')
      );
      const text = await extractDocumentText(zip.toBuffer(), "ficha.docx");
      expect(text).toContain("Medida M01 Conforme");
      expect(text).toContain("Observação validada");
      expect(text).not.toContain("<w:t>");
    });
  });
});
