# STAND — Plataforma de Governação Ambiental

> Plataforma interna da Start Campus para controlar conformidade ambiental, evidência, reporting e desempenho operacional ao longo do ciclo de vida dos projetos.

[![CI](https://github.com/riquid14-ux/ficha-ambiental/actions/workflows/ci.yml/badge.svg)](https://github.com/riquid14-ux/ficha-ambiental/actions/workflows/ci.yml)

## O que resolve

A STAND substitui fluxos dispersos por email, Word, Excel e pastas por um ponto de controlo auditável, com acesso limitado por **papel, empresa e projeto**. É uma referência de código para transferência ao IT; a instalação corporativa deve ser feita numa cópia interna protegida, nunca diretamente neste repositório público.

| Domínio                   | Capacidades principais                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Construção**            | Fichas semanais por GC/EE, evidências, validação por responsabilidade, revisão independente, rejeição parcial e histórico por projeto.   |
| **Conformidade**          | Timeline DCAPE de ciclo de vida, fases, responsáveis, planos de monitorização, calendário APA, documentação controlada e alertas.        |
| **Reporting**             | KPIs, resíduos/e-GAR, MIRR, dashboards, RDCD com curadoria por medida/período e emissão Word sujeita a revisão humana.                   |
| **Operação — SIN01/NEST** | Cockpit operacional, sustentabilidade, reconciliação de faturas, cenários, rastreabilidade de leituras e gateway BMS de Fase 2 assinado. |

### Separação funcional essencial

- **Fichas semanais**: controlo de construção preenchido por GC/EE; a respetiva revisão segue a matriz de responsabilidades.
- **Timeline / DCAPE**: obrigações regulamentares acompanhadas desde o pré-licenciamento até operação e desativação.
- **RDCD**: consolida apenas respostas aprovadas de fichas semanais, por medida e período selecionado; não cria evidência nem parecer técnico automático.

## Segurança e resiliência

- RBAC por papel, empresa, projeto e módulo; separação de deveres entre submissão e aprovação.
- Autenticação local com palavra-passe segura, 2FA TOTP, sessões revogáveis e limitação de tentativas.
- Sanitização de ficheiros, rotas de media autorizadas, proteção de origem e registo de auditoria.
- Preparação para dois nós APP, MariaDB Galera, object storage Synology/S3 privado, Valkey, WAF, backup, watchdog e rollback.
- BMS em **Fase 2**, desativado sem segredo e conta técnica: aceita apenas eventos HTTPS com HMAC, janela temporal, `eventId` idempotente e allowlist; nunca envia comandos à infraestrutura.

> Não colocar palavras-passe, tokens, dados de produção, fotografias não autorizadas ou evidência de projetos neste repositório.

## Começar localmente

**Pré-requisitos:** Node.js 22, pnpm 10 e uma base MySQL/MariaDB de desenvolvimento.

```bash
git clone https://github.com/riquid14-ux/ficha-ambiental.git
cd ficha-ambiental
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Para executar localmente, preencher as variáveis de desenvolvimento fora do Git e iniciar:

```bash
pnpm dev
```

Não use valores de produção numa instalação local. A configuração completa de produção, os segredos e os testes de infraestrutura pertencem ao cofre e ao processo de mudança do IT.

## Entrega ao IT

| Documento                                                                       | Utilização                                                                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Guia prático — Fase 1](docs/GUIA_PRATICO_FASE_1_START_CAMPUS.md)               | Sequência para a arquitetura com HAProxy/BunkerWeb, dois APP nodes, Galera, Synology S3, Valkey, backup e recuperação. |
| [Guia de implementação IT](docs/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.md)          | Integrações de aplicação, ACC, SharePoint, email, segurança e critérios de aceitação.                                  |
| [Guia de implementação IT — Word](docs/GUIA_IMPLEMENTACAO_IT_START_CAMPUS.docx) | Versão formatada para partilha direta com a equipa de IT.                                                              |
| [Integração BMS — Fase 2](docs/INTEGRACAO_BMS_FASE_2.md)                        | Contrato de gateway, HMAC, idempotência, allowlist de métricas e testes de ativação para SIN01/NEST.                   |
| [Resiliência operacional](docs/OPERATIONS-RESILIENCE.md)                        | Watchdog, backup, alertas, rollout e rollback.                                                                         |

O script `ops/migrate-brand-assets.mjs` permite a carga **controlada e privada** das fotografias institucionais no object storage corporativo. Os ativos não devem ser colocados em `client/public` nem enviados para o Git.

## Qualidade verificada

A revisão de referência executou:

```bash
pnpm check
pnpm audit:i18n
pnpm test
pnpm build
pnpm audit --prod
```

Resultado: **618 testes automatizados aprovados**, verificação TypeScript, auditoria de localização, build de produção e auditoria das dependências de produção sem vulnerabilidades conhecidas.

## Contribuir e operar

1. Criar uma branch curta a partir de `main`.
2. Nunca versionar segredos, dados reais ou ficheiros de evidência.
3. Executar os comandos de qualidade acima antes de abrir um pull request.
4. Descrever no PR o âmbito, risco, testes e plano de rollback.
5. Usar revisão independente antes do merge na cópia interna do IT.

Ler [CONTRIBUTING.md](CONTRIBUTING.md) e [SECURITY.md](SECURITY.md) antes de alterar código ou abrir um incidente de segurança.

## Estrutura

```text
client/          frontend React e componentes STAND
server/          API Express/tRPC, segurança, integrações e domínio
shared/          tipos e regras de negócio partilhadas
drizzle/         esquema e migrações MySQL/MariaDB
ops/             bootstrap, backup, deploy, watchdog e rollback
.github/         CI, análise de código, atualizações e automação de incidentes
docs/            guias de implementação e operação
```

## Contacto

Questões de implementação e suporte devem seguir o canal interno da Start Campus. Vulnerabilidades devem ser comunicadas de forma responsável conforme a [política de segurança](SECURITY.md).
