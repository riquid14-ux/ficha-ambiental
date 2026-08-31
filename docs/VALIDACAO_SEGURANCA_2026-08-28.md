# Validação de segurança e resistência operacional

Esta validação foi executada antes da publicação da evolução de mapas, gestão administrativa, EEP e relatórios KPI. Os cenários QA usaram empresas, utilizadores, convites e submissões identificáveis, com endereços não entregáveis, e foram eliminados no fim de cada prova. A base foi confirmada sem resíduos QA e sem relações órfãs nos modelos analisados. Em 31 de Agosto de 2026, o módulo de mapas foi removido integralmente da versão activa; as referências seguintes a mapas são, por isso, históricas e não representam uma superfície de acesso actual.

| Domínio | Evidência executada | Resultado |
| --- | --- | --- |
| Autenticação e validação de entradas | `server/security.test.ts`, `server/owasp-drill.test.ts` e fluxos reais de registo/convite | Aprovado nos cenários testados. |
| Separação de funções | Matriz tRPC de mutações administrativas, Pedidos EEP e Dashboard Parceiros | Aprovado: gestão reservada a Admin; Dashboard Parceiros reservado a EE; o módulo de Mapa foi posteriormente removido. |
| Ciclo de vida administrativo | Empresa, utilizador, convite, aceitação de convite, role, edição, desactivação e limpeza QA | Aprovado com audit trail de operações privilegiadas. |
| Isolamento de EEP | Login QA com acesso limitado a KPI, Resíduos e projecto atribuído; tentativa de rotas EE/Admin | Aprovado nos cenários exercidos. |
| Uploads e tratamento de dados | Provas OWASP, validação de ficheiros e controlos de acesso existentes | Aprovado nos cenários automatizados. |
| Resistência operacional | Detecção de crash loop, redacção de segredos, backup antes de recuperação, notificação e reversão condicionada | Aprovado por testes dos scripts; a activação em servidor Start Campus depende da configuração de produção. |
| Dependências de produção | `pnpm audit --prod` após a resolução de `exceljs@4.4.0 > uuid@11.1.1` | Sem vulnerabilidades moderadas, altas ou críticas reportadas. |

## Limites desta validação

Esta prova confirma contratos de aplicação e comportamentos em ambiente de desenvolvimento. Antes da entrada em produção no servidor Start Campus, a equipa de IT deverá validar credenciais, cópias de segurança restauráveis, destinatários de incidentes, execução do watchdog, regras de rede, certificados TLS, integração ACC/SharePoint e controlo de acessos corporativos. A geração de ortomosaicos não faz parte desta versão; se voltar a ser considerada, deve seguir a referência de segurança e arquitectura em [`FERRAMENTAS_FUTURAS.md`](./FERRAMENTAS_FUTURAS.md).
