import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { canReadDocumentLibrary, registerDocumentLibraryRoutes } from "./document-library";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import { readFileSync } from "node:fs";

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

  it("limita a consulta persistente para proteger a resposta da API", () => {
    const source = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(source).toContain('query.orderBy(desc(documentLibrary.createdAt)).limit(100)');
    expect(source).toContain('query.where(eq(documentLibrary.status, "published")).orderBy(desc(documentLibrary.createdAt)).limit(100)');
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
