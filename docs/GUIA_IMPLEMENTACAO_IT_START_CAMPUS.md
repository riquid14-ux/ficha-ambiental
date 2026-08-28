# Guia de implementação para IT — Plataforma de Gestão Ambiental — Start Campus

**Versão de referência:** checkpoint `6e9cfea8`  
**Repositório:** `https://github.com/riquid14-ux/ficha-ambiental`  
**Branch de integração:** `main`  
**Estado do repositório:** privado; a equipa de IT deve ser adicionada com acesso explícito antes da clonagem.

## 1. Objectivo e princípio de arquitectura

A Plataforma de Gestão Ambiental centraliza workflows de fichas semanais, KPI, resíduos/e-GAR, calendário, planos, fases, EEP, dashboards, relatórios e controlo de acessos. A aplicação deve manter-se **stateless para ficheiros definitivos**: a base de dados guarda identidades, permissões, metadados, estados, auditoria e referências; os documentos aprovados devem ser arquivados no SharePoint da Start Campus como fonte documental oficial.

> A plataforma não deve guardar ficheiros binários no MySQL. O histórico operacional é mantido por metadados e referências, enquanto o SharePoint mantém os documentos aprovados, com a política de retenção corporativa.

| Componente | Responsabilidade alvo | Limite de responsabilidade |
| --- | --- | --- |
| Aplicação React/Express/tRPC | Workflow, validação, permissões, dashboards, exportação e auditoria | Não processa fotogrametria pesada nem armazena documentos definitivos em BLOBs. |
| MySQL/TiDB | Dados transaccionais, índices, estados, auditoria e referências externas | Não é arquivo documental. |
| SharePoint | Arquivo documental oficial de fichas, RDCD, MIRR, planos e evidências aprovadas | Não substitui as regras de negócio e autorização da aplicação. |
| Autodesk Construction Cloud | Entrega e consulta de documentos nos projectos ACC | A plataforma continua a ser responsável pelo workflow ambiental próprio. |
| Serviço de email corporativo | Notificações de submissão, decisão, convite e prazo | Não decide permissões nem substitui alertas na aplicação. |
| Worker NodeODM | Ortofoto/DSM/tiles de capturas DJI nadir a 90° | Nunca corre dentro do processo web da aplicação. |

## 2. Sequência de implementação recomendada

| Ordem | Entrega IT | Critério de saída |
| ---: | --- | --- |
| 1 | Clonar, compilar e executar em **staging** | `pnpm install --frozen-lockfile`, verificação de tipos, testes e build passam. |
| 2 | Preparar DNS, TLS, reverse proxy, conta de serviço e MySQL | `/api/health/live` e `/api/health/ready` respondem correctamente através do domínio de staging. |
| 3 | Configurar segredos e identidade corporativa | Nenhum segredo está no repositório, no frontend ou em ficheiros `.env` versionados. |
| 4 | Integrar SharePoint e validar arquivo/restituição | Uma ficha aprovada é arquivada, fica pesquisável e é recuperável através da referência guardada. |
| 5 | Integrar ACC | Um PDF de teste é entregue na pasta correcta do projecto ACC e a referência devolvida é guardada. |
| 6 | Configurar email corporativo | Convites e notificações chegam ao grupo de teste com remetente Start Campus autenticado. |
| 7 | Activar CI/CD, watchdog, backup e rollback em staging | Um crash-loop simulado cria backup, alerta redundante e recuperação controlada. |
| 8 | Integrar NodeODM isolado e testar voo DJI | Um lote exclusivamente nadir 90° gera outputs privados, sem afectar a disponibilidade da aplicação. |
| 9 | Aprovação de segurança e passagem a produção | Todos os testes de aceitação desta guia têm evidência guardada. |

## 3. Clonagem e execução em staging

Após receber acesso ao repositório privado, a equipa pode clonar a versão actual com:

```bash
git clone https://github.com/riquid14-ux/ficha-ambiental.git
cd ficha-ambiental
git checkout main
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

O servidor deve correr com uma conta de serviço sem privilégios de administração do sistema. A aplicação usa Node.js 22, pnpm 10, MySQL compatível, reverse proxy TLS e um gestor de processos. Em produção, as variáveis de ambiente devem residir num gestor de segredos ou em ficheiros de sistema com permissões restritas; nunca no Git ou no frontend.

| Grupo de configuração | Variáveis/elementos necessários | Regra de segurança |
| --- | --- | --- |
| Aplicação e base de dados | `DATABASE_URL`, segredo de sessão, URL pública, configuração OAuth/identidade | Conta DB com privilégios mínimos; rotação de segredos; cópias de segurança restauráveis. |
| ACC | `ADS_CLIENT_ID`, `ADS_CLIENT_SECRET`, `ACC_PROJECT_ID`, `ACC_FOLDER_ID` | App técnica dedicada; credenciais apenas no backend. |
| SharePoint | `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`, `SHAREPOINT_TENANT_ID`, `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID` | App Microsoft Entra dedicada; acesso apenas ao site/biblioteca ambiental. |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Caixa técnica dedicada; TLS; SPF, DKIM e DMARC no domínio remetente. |
| Watchdog/GitHub | ambiente `/etc/plataforma-ambiental/`, token GitHub App, chave SSH de deploy e destinatários de incidente | Segredos em ficheiros `600` ou cofre; não reutilizar credenciais pessoais. |

## 4. Integração SharePoint como arquivo documental oficial

A Microsoft Graph permite trabalhar com sites, listas e drives/bibliotecas documentais SharePoint e suporta operações de leitura/escrita em `driveItems`.[1] A implementação existente já espera a identidade da aplicação e o identificador da biblioteca documental.

### Configuração IT

1. Criar uma **App Registration** exclusiva para a plataforma no Microsoft Entra ID, com segredo ou, preferencialmente, certificado gerido.
2. Aplicar princípio de privilégio mínimo. Se a política Microsoft 365 da Start Campus o suportar, preferir acesso limitado ao site ambiental seleccionado em vez de permissões de tenant amplas.
3. Criar ou validar a biblioteca documental alvo e obter `SITE_ID` e `DRIVE_ID`.
4. Configurar as variáveis `SHAREPOINT_*` exclusivamente no servidor/gestor de segredos.
5. Criar a estrutura documental abaixo, ajustando apenas a nomenclatura se a política documental interna o exigir:

```text
Ambiente/
  SIN01…SIN07 e Subestação/
    Fichas Semanais/
    Relatórios/
    Planos/
    MIRR/
```

6. Fazer upload de uma ficha de teste, guardar a URL/referência devolvida na aplicação e confirmar: permissões, versão, data, autor, retenção e recuperação.

Os identificadores de site e drive devem ser tratados como configuração, não como valores fixos no código. A Graph permite endereçar bibliotecas por site e drive; usar pedidos selectivos evita transferir campos desnecessários.[1]

## 5. Integração ACC

A documentação Autodesk disponibiliza APIs para ficheiros, formulários, revisões e administração de hub/projecto. A API de ficheiros permite gerir planos, modelos e documentos de projecto; as APIs de revisões e formulários são adequadas quando o fluxo ACC seleccionado pela Start Campus exigir esses artefactos.[2]

O módulo actual entrega documentos através do fluxo Data Management: criar storage, transferir o ficheiro e criar a versão/item no destino. A equipa de IT deve configurar por projecto ACC uma pasta destino e um mapeamento explícito para o projecto da plataforma.

| Configuração | Acção IT | Aceitação |
| --- | --- | --- |
| Aplicação Autodesk técnica | Registar/validar credenciais APS dedicadas e scopes mínimos para o caso de uso. | O token é emitido no backend e nunca chega ao browser. |
| Associação de projecto | Definir `ACC_PROJECT_ID` para cada contexto ACC aplicável. | O ID refere o projecto exacto, não o hub inteiro. |
| Pasta documental | Definir `ACC_FOLDER_ID` na zona ambiental autorizada. | Um PDF de teste surge apenas na pasta Ambiente acordada. |
| Regras de negócio | Mapear tipo de documento, projecto, semana e empresa para o nome/caminho. | Não há sobreposição de documentos de projectos diferentes. |
| Monitorização | Registar erro, correlação e URL de item devolvida, sem expor tokens. | Falhas ACC não bloqueiam a aplicação nem apagam o registo local. |

## 6. Email corporativo e convites

O módulo actual usa SMTP e já inclui notificações de submissão, aprovação/rejeição, convite, eliminação e prazos. A instrução insegura de palavra-passe fixa foi removida: o convite agora orienta cada pessoa a criar a sua palavra-passe no primeiro acesso.

Antes de activar envio real, a equipa deve criar uma caixa técnica, como `apoioamb@…`, e configurar TLS/STARTTLS, SPF, DKIM e DMARC. O modo de staging deve usar uma lista fechada e endereços de teste. Em produção, os destinatários da RAA devem ser definidos por projecto, e os alertas de incidente devem ir para uma lista de distribuição e um suplente, nunca para uma única pessoa.

## 7. Segurança, CI/CD e recuperação operacional

O repositório já contém CI, deployment aprovado, watchdog de PM2, backup, health check e scripts de rollback. A protecção de branch GitHub deve exigir pull request, revisão independente, checks obrigatórios e bloqueio de force-push.[3] O environment `production` deve exigir aprovação humana antes de expor segredos ou iniciar deployment.[4]

| Controlo | Implementação no servidor Start Campus | Prova exigida |
| --- | --- | --- |
| Processo aplicacional | PM2 com backoff e limites de reinício. | Reinício manual não cria crash-loop. |
| Watchdog | Serviço systemd `plataforma-watchdog`, utilizador `plataforma`, configuração em `/etc/plataforma-ambiental/watchdog.env`. | Três falhas em cinco minutos geram um incidente deduplicado. |
| Backup | Dump MySQL comprimido, hash SHA-256, retenção e teste de restauro em staging. | Backup só é aceite depois de uma reposição bem-sucedida. |
| Alertas | Múltiplos destinatários e excerto de log sanitizado. | Tokens/segredos aparecem como `[REDACTED]`. |
| Deploy | Release versionada, mudança atómica de symlink, health check `/api/health/ready`. | Se readiness falhar, a release anterior é reposta. |
| IA de triagem, se aprovada | Pode abrir proposta/PR mínima a partir de incidente sanitizado. | Nunca tem permissão de merge, deploy, migração destrutiva ou leitura de segredos. |

> A IA pode acelerar a investigação, mas a aprovação de código e a publicação continuam a exigir decisão humana.

## 8. Fotogrametria DJI / NodeODM

O Mapa está preparado para referência privada, limites WGS84 individuais, vista global e lotes de imagens. A aplicação aceita para mosaico apenas fotografias DJI **verticais/nadir a 90°**. Fotografias oblíquas a 30° ou 60° não entram no fluxo de ortofoto, pois reduzem a comparabilidade geométrica e podem criar resultados enganadores.

NodeODM disponibiliza uma API REST para processamento de imagens aéreas e a própria documentação recomenda a execução através de Docker.[5] O serviço deve viver numa VM/servidor separado da aplicação, numa rede privada, com armazenamento persistente e recursos dimensionados para o tamanho do lote. Como referência de engenharia, preparar pelo menos 16 GB de RAM para lotes iniciais e confirmar a capacidade através de um voo de ensaio antes de alargar utilização.

O contrato já existente entre aplicação e worker requer:

| Pedido da aplicação | Resposta do worker |
| --- | --- |
| `jobId`, `projectId`, `surveyId`, chaves privadas das fotos e limite WGS84 | `taskUuid`, estado, progresso e mensagem controlada |
| Resolução da ortofoto, geração DSM/tiles/relatório e uso de EXIF | Chaves privadas da ortofoto, tiles, DSM e relatório |
| Pedido de cancelamento | Estado `cancelled` confirmado |
| Consulta de health/progress | Limites calculados, CRS, GSD e erro reprojetivo quando disponíveis |

O worker não deve expor o NodeODM à Internet. A comunicação deve ocorrer por rede privada, autenticação serviço-a-serviço e allowlist; as fotos e outputs devem usar chaves privadas no armazenamento, com URLs temporárias apenas quando necessárias. A aplicação não tem fallback de processamento local: enquanto o worker não estiver configurado, a interface informa claramente que o processamento real não está disponível.

## 9. Testes de aceitação antes de produção

| Cenário | Resultado obrigatório |
| --- | --- |
| Convite de pessoa | A pessoa cria palavra-passe própria; não recebe credencial partilhada; Admin mantém o controlo de roles. |
| EE e EEP | EEP só vê KPI/Resíduos autorizados e projectos permitidos; EE vê apenas os seus parceiros; Admin tem audit trail. |
| SharePoint | Ficha aprovada fica no caminho correcto, com URL/referência e recuperação confirmada. |
| ACC | Documento é carregado uma vez na pasta correcta e a falha devolve erro controlado sem perder o workflow. |
| KPI/MIRR | Exportação por período mostra cabeçalhos profissionais, resumo e detalhe semanal correctos. |
| Mapa | Admin define limites; DO/PM lêem; restantes roles são bloqueados; lote oblíquo é recusado. |
| NodeODM | Lote nadir 90° de ensaio gera resultados privados; falha do worker não degrada KPI, resíduos ou fichas. |
| Recuperação | Crash-loop em staging cria backup, alerta para vários destinatários, issue/PR opcional e rollback após readiness falhar. |
| Segurança | Segredos não surgem em Git/logs; auditoria de dependências, testes e health check passam. |

## 10. Entregáveis que o IT deve devolver à Start Campus

A passagem a produção deve terminar com um dossier de evidências: diagrama de rede e identidades técnicas; inventário de segredos e rotação; mapeamento projecto plataforma→ACC→SharePoint; resultado de testes de upload/arquivo/restauro; prova de SPF/DKIM/DMARC; relatório de health check e rollback; evidência de branch protection/reviews; e relatório do voo NodeODM de aceitação. O template RDCD final continua a ser o elemento funcional que falta para validar a geração do relatório oficial com a estrutura exigida pela APA.

## Referências

[1]: https://learn.microsoft.com/en-us/graph/api/resources/sharepoint?view=graph-rest-1.0 "Microsoft Learn — Working with SharePoint sites in Microsoft Graph"

[2]: https://aps.autodesk.com/en/docs/acc/v1/overview/introduction/ "Autodesk Platform Services — Forma/ACC APIs"

[3]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule "GitHub Docs — Managing a branch protection rule"

[4]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Docs — Using environments for deployment"

[5]: https://opendronemap.org/nodeodm/ "OpenDroneMap — NodeODM"
