# Validação de segurança e resistência operacional

Esta validação foi executada antes da publicação da evolução do Mapa, gestão administrativa, EEP e relatórios KPI. Os cenários QA usaram empresas, utilizadores, convites e submissões identificáveis, com endereços não entregáveis, e foram eliminados no fim de cada prova. A base foi confirmada sem resíduos QA e sem relações órfãs nos modelos analisados.

| Domínio | Evidência executada | Resultado |
| --- | --- | --- |
| Autenticação e validação de entradas | `server/security.test.ts`, `server/owasp-drill.test.ts` e fluxos reais de registo/convite | Aprovado nos cenários testados. |
| Separação de funções | Matriz tRPC de mutações administrativas e leituras de Mapa, Pedidos EEP e Dashboard Parceiros | Aprovado: gestão reservada a Admin; Dashboard Parceiros reservado a EE; Mapa reservado a Admin, Dono de Obra e PM autorizado. |
| Ciclo de vida administrativo | Empresa, utilizador, convite, aceitação de convite, role, edição, desactivação e limpeza QA | Aprovado com audit trail de operações privilegiadas. |
| Isolamento de EEP | Login QA com acesso limitado a KPI, Resíduos e projecto atribuído; tentativa de rotas EE/Admin | Aprovado nos cenários exercidos. |
| Uploads e tratamento de dados | Provas OWASP, validação de ficheiros e controlos de acesso existentes | Aprovado nos cenários automatizados. |
| Resistência operacional | Detecção de crash loop, redacção de segredos, backup antes de recuperação, notificação e reversão condicionada | Aprovado por testes dos scripts; a activação em servidor Start Campus depende da configuração de produção. |
| Dependências de produção | `pnpm audit --prod` após a resolução de `exceljs@4.4.0 > uuid@11.1.1` | Sem vulnerabilidades moderadas, altas ou críticas reportadas. |

## Limites desta validação

Esta prova confirma contratos de aplicação e comportamentos em ambiente de desenvolvimento. Antes da entrada em produção no servidor Start Campus, a equipa de IT deverá validar credenciais, cópias de segurança restauráveis, destinatários de incidentes, execução do watchdog, regras de rede, certificados TLS, integração ACC/SharePoint e controlo de acessos corporativos. A geração de ortomosaicos reais continua dependente de um worker fotogramétrico isolado com NodeODM; não é executada pelo processo web.
