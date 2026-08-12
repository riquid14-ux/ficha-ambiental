# Guia de Integrações — SharePoint e ACC

## Arquitetura de Integração

A Plataforma Ambiental funciona como um **transformador de documentos**: recebe inputs (textos, imagens, ficheiros), processa-os (fichas semanais, RDCD, MIRR) e envia os outputs para fontes externas.

```
┌─────────────────────┐
│  Plataforma Web     │
│  (React + Node.js)  │
└─────────┬───────────┘
          │
    ┌─────┼─────────────────────┐
    │     │                     │
    ▼     ▼                     ▼
┌──────┐ ┌──────────────┐ ┌─────────┐
│MySQL │ │  SharePoint  │ │   ACC   │
│(dados│ │ (documentos) │ │(fichas) │
└──────┘ └──────────────┘ └─────────┘
```

---

## 1. Integração SharePoint (Microsoft Graph API)

### O que é enviado para o SharePoint

| Documento | Pasta SharePoint | Quando |
|---|---|---|
| Fichas semanais (PDF) | `/Projetos/{Código}/Fichas Semanais/` | Após aprovação pela RAA |
| RDCD (Word) | `/Projetos/{Código}/RDCD/` | Após geração pelo wizard |
| Planos submetidos | `/Projetos/Todos/Planos/` | Após upload pelo DO |
| Evidências de fases | `/Projetos/{Código}/Fases/{Fase}/{Ano}/` | Após upload |
| MIRR/Wastemap (Excel) | `/Projetos/SIN01-NEST/MIRR/{Ano}/` | Após exportação |
| e-GARs importadas | `/Projetos/SIN01-NEST/eGARs/` | Após importação |

### Configuração no Azure Portal

1. Aceder a https://portal.azure.com → Azure Active Directory → App Registrations
2. Criar nova aplicação: "Plataforma Ambiental"
3. Em **API Permissions**, adicionar:
   - `Microsoft Graph` → `Sites.ReadWrite.All` (Application)
   - `Microsoft Graph` → `Files.ReadWrite.All` (Application)
4. Em **Certificates & Secrets**, criar um Client Secret
5. Copiar: Tenant ID, Client ID, Client Secret
6. Obter o Site ID do SharePoint:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{site-name}
   ```
7. Obter o Drive ID:
   ```
   GET https://graph.microsoft.com/v1.0/sites/{site-id}/drives
   ```

### Código de Integração

O ficheiro `server/integrations/sharepoint.ts` já contém a lógica completa:
- `uploadToSharePoint(filePath, fileBuffer, contentType)` — envia ficheiro para o SharePoint
- Autenticação via Client Credentials Flow (sem interação do utilizador)
- Criação automática de pastas se não existirem

Para ativar, basta preencher as variáveis `SHAREPOINT_*` no `.env`.

---

## 2. Integração ACC (Autodesk Construction Cloud)

### O que é enviado para o ACC

| Documento | Pasta ACC | Quando |
|---|---|---|
| Fichas semanais (PDF) | `Project Files/Fichas Ambientais/{Semana}/` | Após aprovação |

### Configuração no Autodesk Platform Services

1. Aceder a https://aps.autodesk.com
2. Criar aplicação → tipo "Traditional Web App"
3. Configurar Callback URL: `https://<DOMINIO>/api/autodesk/callback`
4. Copiar Client ID e Client Secret
5. Ativar scopes: `data:read`, `data:write`, `data:create`

### Custom Integration no ACC (para aparecer como tab)

1. Aceder a admin.b360.autodesk.com → Apps → Custom Integrations
2. Add Custom Integration:
   - **Name**: Plataforma Ambiental
   - **URL**: `https://<DOMINIO>`
3. Ativar para os projetos desejados

### Código de Integração

O ficheiro `server/integrations/acc.ts` contém:
- `uploadToACC(projectId, folderId, fileName, fileBuffer)` — envia ficheiro para o ACC
- Autenticação via 2-legged OAuth (Client Credentials)
- Upload em 2 passos: criar storage → upload bytes → criar version

### Autenticação Automática no iframe

Quando a app está dentro do ACC (iframe), a autenticação é automática:
- O ACC injeta o token do Autodesk
- A app valida o token via `/api/autodesk/auto-login`
- O email do Autodesk é cruzado com os utilizadores registados
- Se o email existe → sessão criada automaticamente
- Se não existe → mensagem "Contacte Nairana Aguiar npa@startcampus.pt"

---

## 3. Fluxo de Armazenamento Completo

```
Utilizador submete ficha semanal
    │
    ├── 1. Dados guardados no MySQL (estados, respostas, metadata)
    │
    ├── 2. Imagens/ficheiros → S3 (armazenamento temporário)
    │
    ├── 3. RAA aprova a ficha
    │       │
    │       ├── PDF gerado → SharePoint /Fichas Semanais/
    │       └── PDF gerado → ACC Project Files/ (se configurado)
    │
    └── 4. Dados analíticos disponíveis no Dashboard
```

---

## 4. Testar as Integrações

### Testar SharePoint
```bash
# Após configurar .env com credenciais SharePoint:
node -e "
const { uploadToSharePoint } = require('./server/integrations/sharepoint');
uploadToSharePoint('test/hello.txt', Buffer.from('Hello'), 'text/plain')
  .then(r => console.log('OK:', r))
  .catch(e => console.error('ERRO:', e.message));
"
```

### Testar ACC
```bash
# Após configurar .env com credenciais Autodesk:
node -e "
const { getAccToken } = require('./server/integrations/acc');
getAccToken().then(t => console.log('Token OK:', t.substring(0,20)+'...'))
  .catch(e => console.error('ERRO:', e.message));
"
```

