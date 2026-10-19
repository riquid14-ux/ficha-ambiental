# Manifesto de entrega — STAND / Start Campus

## Código e configuração de execução

| Área | Recursos |
| --- | --- |
| Aplicação | `client/`, `server/`, `shared/`, `package.json`, `pnpm-lock.yaml` |
| Esquema corrente | `drizzle/schema.ts`, `drizzle/relations.ts` |
| Histórico de desenvolvimento | `drizzle/*.sql` e `drizzle/meta/` — referência/auditoria, não instalar numa base fresh start |
| Fresh start | `handover/database-fresh-start/` — única baseline para a base nova |
| Operação | `ops/`, `ecosystem.config.cjs` |
| Segurança e automação | `.github/`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE` |
| Documentação | `docs/` e `handover/` |

## Exclusões confirmadas

O ZIP e o repositório de referência não devem incluir `node_modules`, `dist`, `.env`, chaves/certificados, dumps, logs, downloads, dados de produção, evidências ou quaisquer objetos do Synology/SharePoint/ACC.

## Proveniência

- **Commit de referência:** confirmar com `git log -1 --format='%H %an <%ae>'` antes de criar o ZIP.
- **Autor da revisão de referência:** `RmdRicardo <rmd@startcampus.pt>`.
- **Fonte de verdade funcional:** o código e os guias desta entrega; os segredos e valores internos pertencem ao cofre corporativo.

## Integridade antes de transferência

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm audit --prod
node handover/database-fresh-start/validate-baseline.mjs
ops/create-it-handover-zip.sh ../STAND_IT_HANDOVER_<commit>.zip
sha256sum -c ../STAND_IT_HANDOVER_<commit>.zip.sha256
unzip -tq ../STAND_IT_HANDOVER_<commit>.zip
```

O gerador cria o ZIP apenas a partir do commit Git validado, verifica a baseline, recusa ficheiros proibidos e produz um SHA-256 do ZIP. O IT deve verificar esse checksum depois da cópia para o seu repositório interno.
