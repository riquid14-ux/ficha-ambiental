import { Express, Request, Response } from "express";

const API_DOCS = {
  openapi: "3.0.3",
  info: {
    title: "Ficha de Controlo Ambiental API",
    version: "1.0.0",
    description:
      "API para gestão de fichas de controlo de medidas ambientais em obras. Preparada para integração com Autodesk Construction Cloud (ACC) via APS Data Management API.",
    contact: {
      name: "Equipa de Desenvolvimento",
    },
  },
  servers: [
    {
      url: "/api",
      description: "API Base URL",
    },
  ],
  paths: {
    "/api/trpc/sections.list": {
      get: {
        summary: "Listar todas as secções",
        description: "Retorna as 14 secções de medidas ambientais organizadas por fase (Preparação Prévia, Execução, Fase Final, Desativação).",
        tags: ["Secções"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Lista de secções",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      name: { type: "string" },
                      phase: { type: "string", enum: ["Preparação Prévia", "Execução da Obra", "Fase Final", "Desativação"] },
                      orderIndex: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/trpc/measures.list": {
      get: {
        summary: "Listar todas as 156 medidas",
        description: "Retorna todas as medidas ambientais com número, descrição, responsável e secção associada.",
        tags: ["Medidas"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Lista de medidas",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      sectionId: { type: "integer" },
                      measureNumber: { type: "string", example: "1" },
                      description: { type: "string" },
                      responsible: { type: "string", example: "EE" },
                      orderIndex: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/trpc/submissions.createOrGet": {
      post: {
        summary: "Criar ou obter submissão semanal",
        description: "Cria uma nova ficha semanal ou retorna a existente. Pré-preenche automaticamente com dados da semana anterior.",
        tags: ["Submissões"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["weekNumber", "weekYear", "weekStartDate", "weekEndDate"],
                properties: {
                  weekNumber: { type: "integer", example: 31 },
                  weekYear: { type: "integer", example: 2026 },
                  weekStartDate: { type: "string", example: "28.07" },
                  weekEndDate: { type: "string", example: "03.08" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Submissão criada ou existente" },
        },
      },
    },
    "/api/trpc/responses.save": {
      post: {
        summary: "Guardar respostas das medidas",
        description: "Guarda ou atualiza o estado (I/C/NC/NA) e observações para cada medida numa submissão.",
        tags: ["Respostas"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["submissionId", "responses"],
                properties: {
                  submissionId: { type: "integer" },
                  responses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        measureId: { type: "integer" },
                        status: { type: "string", enum: ["I", "C", "NC", "NA"], nullable: true },
                        observations: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Respostas guardadas com sucesso" },
        },
      },
    },
    "/api/upload/evidence": {
      post: {
        summary: "Upload de imagem de evidência",
        description: "Faz upload de uma imagem de evidência associada a uma medida específica numa submissão.",
        tags: ["Evidências"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["submissionId", "measureId", "data"],
                properties: {
                  submissionId: { type: "integer" },
                  measureId: { type: "integer" },
                  filename: { type: "string" },
                  mimeType: { type: "string", example: "image/jpeg" },
                  data: { type: "string", description: "Imagem em base64" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Upload bem-sucedido",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    url: { type: "string" },
                    fileKey: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/pdf/submission/{id}": {
      get: {
        summary: "Gerar PDF do relatório semanal",
        description: "Gera e descarrega um PDF formatado com todas as medidas, estados e observações da submissão.",
        tags: ["PDF"],
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID da submissão",
          },
        ],
        responses: {
          "200": {
            description: "PDF gerado",
            content: { "application/pdf": {} },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description: "Cookie de sessão obtido após autenticação OAuth",
      },
    },
  },
  tags: [
    { name: "Secções", description: "Gestão das 14 secções de medidas" },
    { name: "Medidas", description: "As 156 medidas ambientais" },
    { name: "Submissões", description: "Fichas semanais de controlo" },
    { name: "Respostas", description: "Estados e observações por medida" },
    { name: "Evidências", description: "Upload de imagens de evidência" },
    { name: "PDF", description: "Geração de relatórios PDF" },
  ],
  "x-acc-integration": {
    description: "Para integração com Autodesk Construction Cloud (ACC), utilize as APS Data Management APIs para fazer upload automático dos PDFs gerados para pastas de projeto no ACC.",
    steps: [
      "1. Registar uma app no Autodesk Developer Portal (https://aps.autodesk.com/)",
      "2. Obter Client ID e Client Secret",
      "3. Configurar OAuth 2.0 (2-legged para server-to-server)",
      "4. Usar Data Management API para criar pasta e fazer upload do PDF",
      "5. Endpoint sugerido: POST /api/acc/publish/{submissionId}",
    ],
    apis: [
      "Data Management API — upload de ficheiros para ACC",
      "ACC API — associar documentos a projetos",
      "Issues API — criar issues para NC (Não Conforme)",
    ],
  },
};

export function registerApiDocs(app: Express) {
  app.get("/api/docs", (_req: Request, res: Response) => {
    res.json(API_DOCS);
  });

  // Simple HTML viewer for the docs
  app.get("/api/docs/viewer", (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>API Documentation - Ficha de Controlo Ambiental</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUI({ url: '/api/docs', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`);
  });
}

