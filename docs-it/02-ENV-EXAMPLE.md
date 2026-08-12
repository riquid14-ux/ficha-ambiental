# Variáveis de Ambiente (.env)

Copiar este conteúdo para um ficheiro `.env` na raiz do projeto e preencher com os valores reais.

```env
# ─── Base de Dados ───────────────────────────────────────────────────────────
# Connection string MySQL (formato: mysql://user:password@host:port/database)
DATABASE_URL=mysql://plataforma:PASSWORD@localhost:3306/plataforma_ambiental

# ─── Segurança ───────────────────────────────────────────────────────────────
# Chave secreta para assinar tokens JWT de sessão (gerar com: openssl rand -hex 32)
JWT_SECRET=GERAR_COM_openssl_rand_hex_32

# ─── Servidor ────────────────────────────────────────────────────────────────
# Porta do servidor (default: 3000)
PORT=3000

# ─── Autodesk Construction Cloud (ACC) ───────────────────────────────────────
# Credenciais da aplicação Autodesk Forge/APS
ADS_CLIENT_ID=
ADS_CLIENT_SECRET=
# URL de callback OAuth do Autodesk (ajustar ao domínio de produção)
ADS_CALLBACK_URL=https://plataforma.startcampus.pt/api/autodesk/callback

# ─── SharePoint (Microsoft Graph API) ────────────────────────────────────────
# Credenciais da aplicação Azure AD para acesso ao SharePoint
SHAREPOINT_TENANT_ID=
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=

# ─── Armazenamento de Ficheiros (S3-compatível) ─────────────────────────────
# Pode ser AWS S3, MinIO, Azure Blob (com gateway S3), ou outro compatível
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=plataforma-ambiental
S3_REGION=eu-west-1

# ─── Aplicação ───────────────────────────────────────────────────────────────
VITE_APP_TITLE=Plataforma Ambiental - Start Campus
```

---

## Notas Importantes

1. **DATABASE_URL**: Usar SSL em produção — adicionar `?ssl={"rejectUnauthorized":true}` ao final
2. **JWT_SECRET**: NUNCA reutilizar entre ambientes (dev/staging/prod)
3. **SharePoint**: Registar uma aplicação no Azure Portal → App Registrations → API Permissions → Microsoft Graph → Sites.ReadWrite.All
4. **ACC**: Registar em https://aps.autodesk.com → Create App → Callback URL deve apontar para o domínio de produção
5. **S3**: Se usar MinIO local, configurar endpoint como `http://localhost:9000`

