# Guia prático de implementação — Fase 1 — STAND / Start Campus

**Estado do código:** preparado para uma instalação corporativa com os componentes do diagrama fornecido.  
**Autor da versão de referência no Git:** `RmdRicardo <rmd@startcampus.pt>`.  
**Âmbito:** publicação da STAND numa zona DMZ com duas instâncias web, dois nós de aplicação, MariaDB Galera, armazenamento Synology compatível com S3, Valkey, ACC, Microsoft 365 e mecanismos de recuperação.

> Este guia é um procedimento de implementação. Não contém endereços internos, passwords, chaves, IDs de tenants, certificados nem configuração real de firewall. Esses valores devem ser definidos pelo IT no cofre corporativo e no registo de alterações.

---

## 1. Decisão de arquitetura

A arquitetura proposta **funciona como Fase 1**, com os seguintes princípios já suportados pelo código:

- A aplicação é **stateless**: qualquer um dos dois nós APP pode receber um pedido. A sessão é um JWT assinado localmente e, em cada pedido, é revalidada contra a base de dados por utilizador, estado de conta e `sessionVersion` (revogação).
- A base de dados é acedida por **um VIP/endpoint único de MariaDB Galera**; os dois nós APP nunca usam discos locais para persistência de negócio.
- Os ficheiros são entregues por uma rota same-origin da aplicação, com autorização reavaliada. Em produção, a origem é um bucket **S3 compatível no Synology**; o browser não recebe chaves do object storage.
- Limites de login são comuns aos dois nós através de **Valkey**, evitando que um atacante contorne o limite alternando entre APP node 1 e APP node 2.
- O BMS é **Fase 2 opcional**: apenas o gateway corporativo inicia conexões HTTPS para a STAND; a aplicação não abre conexões para OT nem envia comandos ao BMS.
- Fichas semanais, Timeline/DCAPE e RDCD mantêm os seus âmbitos separados: a ficha semanal é um fluxo de construção por GC; a Timeline acompanha obrigações DCAPE no ciclo de vida do projeto; o RDCD consolida fichas aprovadas por medida e período, sem inventar evidência.

### 1.1 Correspondência com o diagrama

| Zona do diagrama           | Papel na Fase 1                               | Configuração STAND exigida                                                                    | Observação de segurança                                                                            |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Rede interna               | Utilizadores, IT, RAA, PM, EE, GC e EEP       | DNS interno/externo aponta apenas para o VIP de entrada                                       | Não existe acesso direto a APP, DB, NAS ou Valkey.                                                 |
| DMZ Web Ingress            | VIP VRRP, HAProxy e dois BunkerWeb workers    | Encaminhar `X-Forwarded-For`, `X-Forwarded-Proto=https`, `Host`; limitar request size a 50 MB | O TLS termina no BunkerWeb/WAF. A aplicação já confia em **um** reverse proxy e aplica CSP/Helmet. |
| DMZ App Services           | `APP node 1` e `APP node 2`                   | Mesma release, mesmo `/etc/plataforma-ambiental/app.env`, mas segredos injetados pelo cofre   | Cada nó executa uma instância PM2. Não é necessário sticky session.                                |
| DMZ Data DB                | Dois MariaDB em Galera, acessíveis por VIP DB | `DATABASE_URL` aponta para o VIP, com utilizador de menor privilégio                          | O quorum Galera, backups e restauros são responsabilidade do IT/DBA.                               |
| Synology NAS               | Object storage privado e destino de backup    | `S3_*` no cofre; bucket privado, versão e retenção                                            | Um NAS isolado é ponto único de falha: usar RAID **não** substitui uma segunda cópia/replicação.   |
| BunkerWeb Manager + Valkey | Gestão WAF e estado distribuído               | `VALKEY_URL` privado para limites de autenticação                                             | Valkey não é exposto à Internet. Considerar Sentinel/replica em fase de alta disponibilidade.      |
| Office 365 / Azure OpenAI  | Email e importação PDF, quando configurada    | SMTP com STARTTLS; credenciais Azure apenas nos APP nodes                                     | As saídas partem dos **APP nodes**, não dos workers WAF.                                           |
| ACC                        | Integração documental                         | App APS técnica, `ADS_*`, mapeamento por projeto                                              | Tokens nunca chegam ao browser nem são commitados.                                                 |

## 2. Pré-requisitos e decisões que o IT tem de fechar

Antes de criar VMs, devem ser aprovados estes valores no CAB/change record:

1. **Nome de serviço e DNS:** por exemplo `stand.startcampus.pt`; registar também o URL de staging.
2. **VIPs internos:** VIP de entrada, VIP DB e endpoint S3 do Synology. O diagrama não fixa endereços, portanto os valores 10.x apresentados em exemplos são meramente ilustrativos.
3. **TLS:** decidir se o certificado chega por PKI interna ou ACME/Let's Encrypt. Se for ACME HTTP-01, o desafio tem de chegar à zona BunkerWeb e ao VIP; se o domínio não for publicamente resolúvel, usar DNS-01/PKI interna.
4. **Base de dados:** versão MariaDB suportada, conta `stand_app` de menor privilégio, estratégia de bootstrap Galera, quorum, cópia fora do cluster e prova de restauro.
5. **Synology:** bucket privado S3, conta de serviço exclusiva da STAND, encriptação, versionamento e lifecycle/retention. Não montar o NAS como disco da aplicação.
6. **Valkey:** endpoint TLS privado, palavra-passe/certificado e plano de disponibilidade. A STAND falha fechada na autenticação se o Valkey configurado em produção estiver indisponível.
7. **Correio:** mailbox técnico, SPF/DKIM/DMARC e lista de distribuição para alertas (`ALERT_EMAIL_RECIPIENTS`).
8. **Identidade e ACC:** OAuth APS é opcional; a autenticação local por email/password e 2FA da STAND continua funcional sem um fornecedor de hosting. Identidade corporativa adicional requer configuração separada e testada.
9. **Fase 2 BMS:** só ativar depois de Operação, BMS e Segurança aprovarem as métricas, gateway, NTP e HMAC. Não é pré-requisito da Fase 1.

## 3. O que o repositório já entrega

| Artefacto                                               | Finalidade                                                                      | Ação IT                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ecosystem.config.cjs`                                  | Processo PM2, backoff, memória e reload                                         | Executar uma instância em **cada** APP node.                                                          |
| `ops/bootstrap-app-node.sh`                             | Base Ubuntu/Node/pnpm/PM2, utilizador de serviço e diretórios                   | Executar uma vez por APP node com URL da cópia interna do repositório.                                |
| `ops/app.env.example`                                   | Checklist das variáveis corporativas, sem segredo real                          | Copiar para `/etc/plataforma-ambiental/app.env`, preencher no cofre, permissões 640.                  |
| `ops/node-readiness-check.sh`                           | Valida binários, `current`, configuração e readiness                            | Executar antes de colocar o nó no balanceador.                                                        |
| `ops/nginx/stand.conf.example`                          | Referência de proxy de dois nós e cabeçalhos corretos                           | Adaptar ao BunkerWeb/HAProxy existente; não instalar Nginx adicional se BunkerWeb cumprir esse papel. |
| `ops/backup-database.sh`                                | Dump consistente, gzip, checksum e retenção                                     | Agendar no servidor/serviço autorizado e testar restauro.                                             |
| `ops/deploy-release.sh` + `ops/rollback-to-previous.sh` | Release imutável, symlink atómico, health check e rollback                      | Usar pelo workflow aprovado, nunca por cópia manual em `current`.                                     |
| `ops/pm2-crash-watchdog.mjs`                            | Detecta crash-loop, guarda log sanitizado, executa backup e pode pedir rollback | Instalar a unidade `plataforma-watchdog.service`.                                                     |
| `ops/systemd/plataforma-*-reminder.*`                   | Lembretes semanais e de prazos com timers locais                                | Instalar com `ops/install-schedulers.sh` após configurar token.                                       |
| `server/bms-ingest.ts`                                  | Endpoint BMS com HMAC, timestamp, allowlist e idempotência                      | Manter inativo até à Fase 2.                                                                          |

## 4. Procedimento de instalação, por ordem

### Passo 1 — Criar uma cópia interna do repositório

O repositório de referência é público apenas para transferência de código e **não deve receber segredos ou configurações de produção**. Antes de começar, o IT deve criar/usar uma cópia interna com `main` protegido:

```bash
git clone https://github.com/riquid14-ux/ficha-ambiental.git stand-platform
cd stand-platform
git remote rename origin source-reference
git remote add origin <URL-DO-REPOSITORIO-INTERNO>
git push -u origin main --tags
```

No repositório interno:

- exigir pull request e uma revisão independente para `main`;
- tornar obrigatórios `pnpm check`, `pnpm test`, `pnpm build` e `pnpm audit --prod`;
- bloquear force-push em `main`;
- criar ambiente GitHub `production` com aprovador humano;
- criar deploy key/conta técnica sem acesso pessoal;
- manter o workflow de triagem de incidentes com permissões mínimas. Uma eventual IA pode criar uma proposta/PR; não pode fazer merge, deploy, alterar secrets ou migrar a base por conta própria.

### Passo 2 — Preparar as VMs

Repetir em `APP node 1` e `APP node 2`, com uma imagem Ubuntu 24.04 atualizada e regras de patching aprovadas:

```bash
sudo bash ops/bootstrap-app-node.sh <URL-DO-REPOSITORIO-INTERNO> main
sudoedit /etc/plataforma-ambiental/app.env
sudoedit /etc/plataforma-ambiental/watchdog.env
sudoedit /etc/plataforma-ambiental/scheduler.env
```

O script cria o utilizador sem login `plataforma`, `/opt/plataforma-ambiental/{releases,incoming,current}`, e diretórios de incidentes/backups com permissões restritas. **Não iniciar PM2 até os ficheiros de ambiente estarem preenchidos.**

Variáveis mínimas de produção:

```dotenv
NODE_ENV=production
STAND_RUNTIME_MODE=corporate
PORT=3000
APP_BASE_URL=https://stand.startcampus.pt
DATABASE_URL=mysql://stand_app:<segredo>@<vip-db>:3306/stand
JWT_SECRET=<32+ caracteres aleatórios>
SESSION_ISSUER=stand-environmental-prod
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<synology-s3-privado>:9000
S3_REGION=eu-west-1
S3_BUCKET=stand-private
S3_ACCESS_KEY_ID=<conta-tecnica>
S3_SECRET_ACCESS_KEY=<cofre>
S3_FORCE_PATH_STYLE=true
VALKEY_URL=rediss://:<segredo>@<valkey-vip>:6379/0
SCHEDULER_TOKEN=<32+ caracteres aleatórios>
```

Nas VMs Start Campus, `STAND_RUNTIME_MODE=corporate` ativa a verificação de arranque: a aplicação recusa arrancar sem DB, segredo de sessão, URL pública, object storage S3, Valkey e token do scheduler. Isto evita um deployment corporativo que pareça funcional, mas esteja dependente de memória local ou armazenamento de desenvolvimento. O modo gerido existente não ativa por engano estes pré-requisitos internos.

### Passo 3 — MariaDB Galera e migrations

1. O DBA instala e valida Galera com dois nós **e define o plano de perda de quorum**. Com apenas dois nós, a decisão sobre arbitrator/terceiro voto deve ser explícita; o diagrama apresenta um arbitrator e essa configuração deve ser testada.
2. Criar `stand_app` com apenas os privilégios necessários sobre a base STAND. A conta de migração pode ser distinta e usada só na janela de mudança.
3. Restaurar uma cópia sanitizada de staging ou iniciar uma base vazia conforme o plano de dados aprovado.
4. Na janela de alteração, executar migrations uma única vez contra o VIP DB, a partir de um nó de administração controlado:

```bash
cd /opt/plataforma-ambiental/current
set -a; source /etc/plataforma-ambiental/app.env; set +a
pnpm drizzle-kit migrate
```

5. Só depois de backup e migration bem-sucedidos, validar `SELECT 1`, tabelas e `/api/health/ready`.

> Nunca executar migrações destrutivas automaticamente no deploy. O pipeline publica uma release; a alteração de esquema é uma etapa aprovada e registada.

### Passo 4 — Synology Object Storage / NAS

1. Criar bucket privado `stand-private` (nome ilustrativo), sem acesso anónimo e sem política pública.
2. Criar uma conta S3 exclusiva, limitada a esse bucket/prefixo.
3. Ligar versionamento, encriptação e lifecycle conforme a retenção ambiental; ativar cópia/replicação fora do NAS se o NAS for único.
4. Configurar `S3_*` no cofre de cada APP node. Para endpoints Synology, usar normalmente `S3_FORCE_PATH_STYLE=true`.
5. Validar upload, leitura autorizada e tentativa de acesso não autorizado. No browser deve surgir uma rota da STAND, não uma chave do object storage.

### Carga inicial de fotografia institucional

As fotografias não são guardadas em `client/public` nem entregues sem controlo de acesso. Antes de abrir a STAND aos utilizadores, o IT obtém da equipa de Marca os 18 JPGs autorizados (`start-campus-1.jpg`, …, `start-campus-19.jpg`, de acordo com os ficheiros existentes) e executa, num APP node com o ambiente S3 carregado:

```bash
cd /opt/plataforma-ambiental/current
set -a; source /etc/plataforma-ambiental/app.env; set +a
node ops/migrate-brand-assets.mjs /diretorio-restrito/start-campus-brand
```

O script valida que cada ficheiro existe e tem tamanho plausível, usa apenas a conta S3 de serviço e escreve as chaves internas usadas pelo tema. O diretório de importação não é versionado, não é servido pelo Nginx/BunkerWeb e deve ser removido depois da validação visual.

### Passo 5 — WAF, balanceador e rede

O diagrama usa HAProxy + BunkerWeb. O código não requer um produto específico de WAF, mas requer que o proxy preserve os cabeçalhos reais e faça health checks.

- Internet/Redes de utilizador → apenas VIP VRRP em 443;
- HAProxy → BunkerWeb workers; BunkerWeb → `APP node 1:3000` e `APP node 2:3000`;
- health check de cada APP node: `GET /api/health/live` (processo) e, antes de promoção, `GET /api/health/ready` (DB acessível);
- permitir `X-Forwarded-For` apenas vindo do proxy confiável; não permitir ao cliente externo escolher esse cabeçalho;
- os APP nodes aceitam apenas tráfego dos workers WAF; DB, NAS e Valkey aceitam apenas APP nodes;
- manter o limite do proxy em 50 MB e aplicar regras WAF para uploads, autenticação e APIs;
- o tráfego SMTP 587 e HTTPS para Azure/APS/Graph sai dos APP nodes via egress controlado.

A configuração de `ops/nginx/stand.conf.example` é uma referência de upstream e cabeçalhos; **não cria um terceiro proxy** quando HAProxy/BunkerWeb já ocupam esse lugar.

### Passo 6 — Arranque e entrada no balanceador

Em cada APP node:

```bash
cd /opt/plataforma-ambiental/current
sudo -u plataforma APP_CURRENT_PATH=/opt/plataforma-ambiental/current \
  APP_ENV_FILE=/etc/plataforma-ambiental/app.env \
  pm2 startOrReload ecosystem.config.cjs --env production --update-env
sudo -u plataforma pm2 save
sudo bash ops/node-readiness-check.sh
```

Colocar primeiro um nó no pool BunkerWeb, validar login, uma operação de leitura e upload num projeto de teste. Depois repetir no segundo nó. Finalmente desligar um nó do pool: a sessão existente e a operação do outro nó devem continuar, pois não dependem de afinidade de sessão.

### Passo 7 — Lembretes, watchdog e recuperação

Instalar em ambos os nós apenas se se aceitar a deduplicação de lembretes por base de dados; alternativamente, ativar os timers num nó designado e documentar o failover.

```bash
cd /opt/plataforma-ambiental/current
sudo bash ops/install-schedulers.sh
sudo install -m 644 ops/systemd/plataforma-watchdog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now plataforma-watchdog.service
sudo systemctl status plataforma-watchdog.service --no-pager
sudo systemctl list-timers 'plataforma-*-reminder.timer'
```

O scheduler usa token próprio, não uma sessão de utilizador. O watchdog, ao identificar crash-loop, guarda logs com permissões restritas, cria backup antes de recuperação e notifica destinatários redundantes. O rollback automático só deve ser ligado (`WATCHDOG_AUTO_ROLLBACK=true`) depois do ensaio em staging.

## 5. Testes obrigatórios de aceitação

| Teste              | Procedimento                                                                                   | Critério de aceitação                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Compilação         | `pnpm install --frozen-lockfile && pnpm check && pnpm test && pnpm build && pnpm audit --prod` | Todos os comandos terminam com sucesso.                                                 |
| Nó 1 / nó 2        | Retirar alternadamente cada APP node do pool durante uma sessão ativa                          | O utilizador continua no outro nó e o serviço responde.                                 |
| Sessão revogada    | Alterar/resetar password ou revogar sessão e reutilizar token antigo                           | Token é recusado porque `sessionVersion` já não coincide.                               |
| Limite distribuído | Simular falhas de login alternando os nós                                                      | A limitação é aplicada em ambos pelo Valkey.                                            |
| S3 protegido       | Carregar evidência; tentar URL/chave sem acesso e com outro projeto                            | Aceder apenas pela rota autorizada; 401/404 sem enumerar objeto.                        |
| Base de dados      | Parar um membro Galera conforme runbook                                                        | O cluster só se mantém disponível se o quorum estiver preservado; documentar resultado. |
| Backup/restauro    | Restauro num ambiente isolado                                                                  | Dump, checksum e recuperação validados pelo DBA.                                        |
| WAF/Proxy          | Upload, CORS ACC, CSP, IP real e 50 MB                                                         | Funcionalidade esperada sem abrir APP diretamente à Internet.                           |
| Watchdog           | Simular crash-loop em staging                                                                  | Incidente, log sanitizado, backup, alerta e rollback conforme a política.               |
| BMS Fase 2         | Aplicar os nove testes do documento BMS                                                        | Só ativar após HMAC, idempotência e reconciliação aprovados.                            |

## 6. Integrações aplicacionais

### ACC

Criar uma aplicação APS técnica e configurar `ADS_CLIENT_ID`, `ADS_CLIENT_SECRET` e `ADS_REDIRECT_URI` no cofre. Confirmar o mapeamento explícito **STAND project → ACC project → pasta ambiental**. Falhas ACC não podem apagar a ficha ou evidência interna.

### SharePoint / Graph

O SharePoint continua a ser a fonte documental oficial para documentos aprovados, segundo a política corporativa. Criar uma app Entra dedicada, limitada ao site/biblioteca ambiental, e validar upload, versão, metadados e recuperação. Não usar a base de dados como BLOB store.

### Email

Usar uma mailbox técnica Start Campus com STARTTLS 587. Validar SPF, DKIM e DMARC. O grupo em `ALERT_EMAIL_RECIPIENTS` deve incluir pelo menos uma lista de distribuição e um suplente; não usar o email pessoal de uma única pessoa como ponto de falha.

### BMS — fase 2

O endpoint existe, mas permanece desativado sem `BMS_INGEST_HMAC_SECRET` e `BMS_SERVICE_USER_ID`. Ler [Integração BMS — Fase 2](./INTEGRACAO_BMS_FASE_2.md) antes de configurar o gateway. O gateway envia eventos pequenos, com HMAC e `eventId`; não há controlo remoto de infraestrutura pela STAND.

## 7. Limites e melhorias recomendadas

1. **Dois nós Galera + arbitrator** podem operar, mas a resiliência é inferior a três nós de dados completos. O DBA deve validar quorum, rede e recuperação de split-brain.
2. **Um Synology NAS único** é um ponto único de falha para object storage e backups. RAID protege discos, não o equipamento/local. Programar replicação, backup offline/imutável ou segundo destino.
3. **Valkey único** torna-se dependência da autenticação distribuída. Para alta disponibilidade, usar replica + Sentinel/cluster conforme padrão IT.
4. **BunkerWeb Manager único** é uma dependência do plano de controlo WAF; a indisponibilidade não deve interromper tráfego, mas impede alterações centralizadas. Registar estratégia de backup/configuração.
5. A STAND tem testes de tipos, regressões funcionais e segurança no repositório. A aceitação da infraestrutura (failover real, WAF, Galera, NAS, certificados, email e BMS) só pode ser declarada concluída depois dos testes acima no ambiente Start Campus.

## 8. Sequência de go-live

1. Staging totalmente configurado, migrations aprovadas e testes de aceitação guardados.
2. Revisão conjunta Segurança + IT + Ambiente + Operação NEST.
3. Janela de produção: backup, release, migration aprovada, nó 1, health, nó 2, health, WAF/VIP, teste de login e de ficheiro.
4. Período de observação acordado: PM2, health, logs, Valkey, Galera, NAS, correio e integrações.
5. Fecho da alteração: atualizar inventário de segredos, versões, owners, prova de restauro e plano de rollback.

---

## Referências técnicas no repositório

- [Guia geral de implementação IT](./GUIA_IMPLEMENTACAO_IT_START_CAMPUS.md)
- [Integração BMS — Fase 2](./INTEGRACAO_BMS_FASE_2.md)
- [Avaliação da arquitetura Fase 1](./AVALIACAO_ARQUITETURA_FASE_1_STAND.docx)
- `ops/app.env.example`
- `ops/bootstrap-app-node.sh`
- `ops/nginx/stand.conf.example`
- `ops/deploy-release.sh`
- `ops/rollback-to-previous.sh`
- `ops/pm2-crash-watchdog.mjs`
