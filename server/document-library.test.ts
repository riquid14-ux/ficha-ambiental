import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { canReadDocumentLibrary, registerDocumentLibraryRoutes } from "./document-library";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import { readFileSync } from "node:fs";
import { getDocumentLibraryView } from "../client/src/lib/document-library-view";
import { DocumentLibraryReadOnlyContent, type LibraryItem } from "../client/src/pages/DocumentLibrary";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function callerFor(role: string) {
  const ctx: TrpcContext = {
    user: {
      id: 8181,
      openId: `document-library-${role}`,
      email: `${role}@example.invalid`,
      name: `Perfil ${role}`,
      loginMethod: "password",
      role: role as any,
      companyId: 1,
      accountStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

function capturePdfRoute() {
  let handler: ((req: any, res: any) => Promise<void>) | undefined;
  registerDocumentLibraryRoutes({
    get: (_path: string, routeHandler: typeof handler) => { handler = routeHandler; },
  } as any);
  if (!handler) throw new Error("Rota privada de PDF não registada.");
  return handler;
}

function createResponse() {
  const response = {
    headersSent: false,
    status: vi.fn(),
    send: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("Biblioteca documental — acesso por perfil", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("aceita apenas os perfis autorizados a consultar documentação", () => {
    for (const role of ["admin", "dono_obra", "pm", "raa", "ee"]) expect(canReadDocumentLibrary({ role })).toBe(true);
    for (const role of ["ee_partner", "rap", "observador", "user"]) expect(canReadDocumentLibrary({ role })).toBe(false);
  });

  it("mantém Documentação como única rota operacional para EE e RAA", async () => {
    const { getVisibleNavigationPaths } = await import("../client/src/lib/role-navigation");
    for (const role of ["ee", "raa"]) {
      expect(getVisibleNavigationPaths({ role, isAllProjects: false, isOperationOnly: true })).toEqual(["/welcome", "/documentacao"]);
    }
  });

  it("impede EEP, RAP e Observador de listar documentos em runtime", async () => {
    const listSpy = vi.spyOn(db, "listDocumentLibrary");
    for (const role of ["ee_partner", "rap", "observador"]) {
      await expect(callerFor(role).documentLibrary.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("entrega apenas documentos publicados à EE e permite rascunhos à Administração", async () => {
    const listSpy = vi.spyOn(db, "listDocumentLibrary").mockResolvedValue([] as any);
    await callerFor("ee").documentLibrary.list();
    expect(listSpy).toHaveBeenLastCalledWith(false);
    await callerFor("admin").documentLibrary.list();
    expect(listSpy).toHaveBeenLastCalledWith(true);
  });

  it("permite a consulta em runtime a EE, Dono de Obra, PM e RAA", async () => {
    const listSpy = vi.spyOn(db, "listDocumentLibrary").mockResolvedValue([] as any);
    for (const role of ["ee", "dono_obra", "pm", "raa"]) {
      await expect(callerFor(role).documentLibrary.list()).resolves.toEqual([]);
    }
    expect(listSpy).toHaveBeenCalledTimes(4);
    expect(listSpy).toHaveBeenCalledWith(false);
  });

  it("apresenta a mesma Central obrigatória em modo apenas de consulta a EE e PM", () => {
    const centralDocument = { id: 8282, isProjectCentral: 1, isMandatoryRead: 1 };
    for (const role of ["ee", "pm"] as const) {
      const view = getDocumentLibraryView(role, [centralDocument]);
      expect(view.canRead).toBe(true);
      expect(view.showManagementControls).toBe(false);
      expect(view.centralDocuments).toEqual([centralDocument]);
    }
    const librarySource = readFileSync(new URL("../client/src/pages/DocumentLibrary.tsx", import.meta.url), "utf8");
    expect(librarySource).toContain("getDocumentLibraryView(role, documents)");
  });

  it("renderiza a Central obrigatória para EE e PM sem ações administrativas", () => {
    const centralDocument: LibraryItem = {
      id: 8282,
      topic: "obrigacoes_ambientais",
      subtopic: null,
      title: "DCAPE — documento-base obrigatório",
      language: "Português (Portugal)",
      description: "Regras ambientais aplicáveis ao projeto.",
      filename: "dcape.pdf",
      fileSize: 2048,
      status: "published",
      isProjectCentral: 1,
      isMandatoryRead: 1,
      createdByName: "Start Campus",
      createdAt: new Date(),
    };
    for (const role of ["ee", "pm"] as const) {
      const markup = renderToStaticMarkup(createElement(DocumentLibraryReadOnlyContent, { role, documents: [centralDocument] }));
      expect(markup).toContain("Central de Documentos do Projeto");
      expect(markup).toContain("DCAPE — documento-base obrigatório");
      expect(markup).toContain("Obrigatório");
      expect(markup).not.toContain("Criar documento");
      expect(markup).not.toContain("Editar documento");
      expect(markup).not.toContain("Arquivar documento");
      expect(markup).not.toContain("Eliminar documento");
    }
  });

  it("devolve documentos centrais publicados aos cinco perfis autorizados sem expor a chave de storage", async () => {
    const centralDocument = {
      id: 8282,
      title: "DCAPE — documento-base",
      status: "published",
      isProjectCentral: 1,
      isMandatoryRead: 1,
      centralOrder: 0,
      fileKey: "document-library/interno/dcape.pdf",
    } as any;
    vi.spyOn(db, "listDocumentLibrary").mockResolvedValue([centralDocument]);
    for (const role of ["admin", "dono_obra", "pm", "raa", "ee"]) {
      const items = await callerFor(role).documentLibrary.list();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 8282, isProjectCentral: 1, isMandatoryRead: 1 });
      expect(items[0]).not.toHaveProperty("fileKey");
    }
  });

  it("autoriza a rota privada de PDF para Dono de Obra, PM e RAA antes de obter o ficheiro", async () => {
    const route = capturePdfRoute();
    const documentSpy = vi.spyOn(db, "getDocumentLibraryItemById").mockResolvedValue({
      id: 7171,
      status: "published",
      fileKey: "document-library/referencia-interna.pdf",
      filename: "referencia.pdf",
    } as any);
    const authSpy = vi.spyOn(sdk, "authenticateRequest");

    for (const role of ["dono_obra", "pm", "raa"]) {
      authSpy.mockResolvedValueOnce({ role } as any);
      const response = createResponse();
      await route({ params: { id: "7171" } }, response);
      expect(documentSpy).toHaveBeenCalledWith(7171);
      expect(response.status).not.toHaveBeenCalledWith(401);
      expect(response.status).not.toHaveBeenCalledWith(403);
    }
  });

  it("recusa a rota privada de PDF a perfil não autorizado antes de consultar metadados", async () => {
    const route = capturePdfRoute();
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ role: "ee_partner" } as any);
    const documentSpy = vi.spyOn(db, "getDocumentLibraryItemById");
    const response = createResponse();

    await route({ params: { id: "7171" } }, response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith("Sem autorização para consultar documentação.");
    expect(documentSpy).not.toHaveBeenCalled();
  });

  it("rejeita um carregamento que não seja um PDF válido antes de aceder ao storage", async () => {
    const uploadSpy = vi.spyOn(db, "createDocumentLibraryItem");
    await expect(callerFor("admin").documentLibrary.create({
      topic: "obrigacoes_ambientais",
      title: "Guia de teste",
      language: "Português (Portugal)",
      filename: "teste.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("conteúdo que não é PDF e tem tamanho suficiente").toString("base64"),
      status: "draft",
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Carregue um PDF válido até 10 MB." });
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("rejeita nomes de ficheiro que tentem introduzir caminhos no storage", async () => {
    const uploadSpy = vi.spyOn(db, "createDocumentLibraryItem");
    await expect(callerFor("admin").documentLibrary.create({
      topic: "obrigacoes_ambientais",
      title: "Guia de teste",
      language: "Português (Portugal)",
      filename: "../guia.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF-1.4\nvalidação\n%%EOF").toString("base64"),
      status: "draft",
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Indique um nome de ficheiro PDF válido." });
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("impede que a leitura obrigatória seja marcada fora da Central de Documentos", async () => {
    const createSpy = vi.spyOn(db, "createDocumentLibraryItem");
    await expect(callerFor("admin").documentLibrary.create({
      topic: "obrigacoes_ambientais",
      title: "DCAPE de referência",
      language: "Português (Portugal)",
      filename: "dcape.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF-1.4\nconteúdo de teste\n%%EOF").toString("base64"),
      status: "published",
      isProjectCentral: false,
      isMandatoryRead: true,
      centralOrder: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A leitura obrigatória requer destaque na Central de Documentos." });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("impede tornar obrigatória a leitura de um documento já existente fora da Central", async () => {
    vi.spyOn(db, "getDocumentLibraryItemById").mockResolvedValue({
      id: 8182, topic: "obrigacoes_ambientais", subtopic: null, isProjectCentral: 0, isMandatoryRead: 0,
    } as any);
    await expect(callerFor("admin").documentLibrary.update({ id: 8182, isMandatoryRead: true })).rejects.toMatchObject({
      code: "BAD_REQUEST", message: "A leitura obrigatória requer destaque na Central de Documentos.",
    });
  });

  it("apresenta a Central de Documentos e a configuração explícita de título, descrição, língua e PDF", () => {
    const librarySource = readFileSync(new URL("../client/src/pages/DocumentLibrary.tsx", import.meta.url), "utf8");
    const adminSource = readFileSync(new URL("../client/src/pages/DocumentLibraryAdminTab.tsx", import.meta.url), "utf8");
    expect(librarySource).toContain("Central de Documentos do Projeto");
    expect(librarySource).toContain("DCAPE, PGA e outros documentos-base");
    expect(librarySource).toContain("publicada pela Start Campus");
    expect(librarySource).toContain("item.isProjectCentral !== 1");
    expect(adminSource).toContain("Configuração da Documentação");
    expect(adminSource).toContain("Título do documento");
    expect(adminSource).toContain("Descrição de consulta");
    expect(adminSource).toContain("Língua de redacção");
    expect(adminSource).toContain("PDF (máx. 10 MB)");
    expect(adminSource).toContain("Destacar na Central de Documentos do Projeto");
  });

  it("limita a consulta persistente para proteger a resposta da API", () => {
    const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(source).toContain("desc(documentLibrary.isProjectCentral)");
    expect(source.match(/\.limit\(100\)/g)).toHaveLength(2);
  });

  it("revoga o registo documental sem escrever a chave privada de storage na auditoria", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routerSource).toContain('"document_library_deleted"');
    expect(routerSource).toContain('JSON.stringify({ title: existing.title })');
    expect(routerSource).not.toContain('JSON.stringify({ title: existing.title, fileKey: existing.fileKey })');
  });

  it("remove a referência do documento e mantém a auditoria sem chave de storage", async () => {
    const existing = { id: 9191, title: "Documento QA", fileKey: "document-library/interno-nao-exposto.pdf" } as any;
    const getSpy = vi.spyOn(db, "getDocumentLibraryItemById").mockResolvedValue(existing);
    const deleteSpy = vi.spyOn(db, "deleteDocumentLibraryItem").mockResolvedValue();
    const auditSpy = vi.spyOn(db, "insertAuditLog").mockResolvedValue(undefined as any);

    await expect(callerFor("admin").documentLibrary.delete({ id: 9191 })).resolves.toEqual({ success: true });
    expect(getSpy).toHaveBeenCalledWith(9191);
    expect(deleteSpy).toHaveBeenCalledWith(9191);
    expect(auditSpy).toHaveBeenCalledWith(
      8181,
      "Perfil admin",
      "document_library_deleted",
      "document_library",
      9191,
      JSON.stringify({ title: "Documento QA" }),
      null,
    );
    expect(String(auditSpy.mock.calls[0]?.[5])).not.toContain("interno-nao-exposto");
  });
});
