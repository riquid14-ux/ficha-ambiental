# Segurança de Pré-Lançamento — Plataforma de Gestão Ambiental

**Data:** 10 de setembro de 2026  
**Âmbito:** aplicação, rotas de API, autenticação, armazenamento de documentos e dependências.  
**Limite desta validação:** este registo comprova o que está implementado e testado na aplicação. Não substitui a configuração do servidor, da base de dados, do WAF, das cópias de segurança e da gestão de identidades que a equipa de IT da Start Campus terá de operar no ambiente corporativo.

## Resultado resumido

> A aplicação tem controlos técnicos activos para autenticação, permissões no servidor, validação de entradas, limitação de tentativas, sanitização de ficheiros, cabeçalhos HTTP e auditoria. A segurança não pode ser garantida de forma absoluta; requer actualizações contínuas, monitorização e os controlos de infraestrutura indicados abaixo.

| # | Controlo | Estado na aplicação | Evidência ou limitação |
|---:|---|---|---|
| 1 | Chaves privadas | Activo | Segredos lidos apenas por variáveis de ambiente do servidor; não são enviados nos procedimentos tRPC. |
| 2 | Separação desenvolvimento/produção | Parcial | O comportamento depende de `NODE_ENV`; a equipa IT deve usar variáveis, base de dados e credenciais separadas em produção. |
| 3 | Cópias de segurança automáticas | Infraestrutura | O plano de recuperação está documentado, mas o agendamento e a retenção devem ser configurados e verificados pela Start Campus no alojamento e base de dados definitivos. |
| 4 | HTTPS | Activo | Cookies seguras e HSTS; a publicação deve manter domínio com TLS válido. |
| 5 | Cifragem de dados sensíveis | Parcial | Palavras-passe usam hash bcrypt e o tráfego usa TLS. A cifragem em repouso de base de dados e storage depende do fornecedor/servidor corporativo. |
| 6 | Autenticação no servidor | Activo | Rotas sensíveis usam sessão protegida e o servidor verifica o utilizador antes de devolver ou alterar dados. |
| 7 | Restrição de acessos | Activo | Papéis, associação empresa-projecto e permissões EEP são verificados no servidor; a interface apenas espelha essas regras. |
| 8 | Mass assignment | Activo | Entradas tRPC são validadas por esquemas Zod e campos administrativos são seleccionados explicitamente. |
| 9 | Cookies protegidas | Activo | `Secure`, `HttpOnly`, `SameSite` e HSTS são aplicados no fluxo de sessão HTTPS. |
| 10 | Hash de palavras-passe | Activo | bcrypt com salt; nunca é guardada palavra-passe em texto simples. |
| 11 | Rate limiting | Activo | Tentativas de autenticação e operações de leitura/escrita da biblioteca documental têm limites por janela temporal. |
| 12 | Protecção contra bots | Parcial | Rate limiting activo; em alojamento com várias instâncias, a equipa IT deve usar WAF/CDN e armazenamento de limites partilhado. CAPTCHA adaptativo pode ser configurado no reverse proxy/CDN quando aplicável. |
| 13 | Consultas parametrizadas | Activo | Acesso principal à base de dados através de Drizzle ORM e parâmetros, sem concatenação de entradas em SQL de negócio. |
| 14 | Validação de inputs | Activo | Zod limita formatos, tamanhos e opções; uploads passam por verificação de tipo e sanitização. |
| 15 | Respostas sem dados sensíveis | Activo | Chaves internas de storage não são devolvidas pela API da biblioteca; o cliente recebe apenas metadados necessários. |
| 16 | Restrição de uploads | Activo | Apenas PDF, máximo 10 MB, nome sem caminhos, base64 válido, cabeçalho/fim de PDF e sanitização antes do storage. |
| 17 | Limite de respostas API | Activo | Biblioteca documental limitada a 100 registos por resposta. |
| 18 | Cabeçalhos de segurança | Activo | Helmet, CSP explícita, HSTS, `X-Content-Type-Options` e `Referrer-Policy`; em produção, scripts inline não são permitidos pela CSP. |
| 19 | Análise de dependências | Activo | Auditoria de dependências de produção executada sem vulnerabilidades conhecidas. Nodemailer foi actualizado e `adm-zip` foi substituído por `yauzl`, com limites de entradas e descompressão para DOCX. A auditoria deve também correr no CI/CD corporativo. |
| 20 | Defesa além de RLS | Activo | As regras estão no router e na camada de entrega de ficheiros; não dependem apenas de controlo de linhas na base de dados. |

## Biblioteca documental privada

Os PDFs do repositório de documentação guardam no banco apenas metadados e uma chave interna; os bytes ficam no armazenamento externo. A consulta passa por `/api/documentos/:id/pdf`, que exige sessão válida, verifica o papel autorizado e não disponibiliza a chave de storage ao browser. EE, Dono de Obra, PM, RAA e Administrador podem consultar documentos **publicados**; EEP, RAP e Observador não podem listá-los nem abrir a rota de PDF. Rascunhos e documentos arquivados permanecem exclusivos da Administração.

| Acção | Perfil autorizado | Registo e protecção |
|---|---|---|
| Criar, editar, publicar, arquivar e retirar um documento | Administrador | Registo de auditoria, limite de operações e validação do PDF. |
| Consultar documento publicado | EE, Dono de Obra, PM, RAA, Administrador | Sessão, verificação de papel e rota privada. |
| Consultar rascunho ou arquivado | Administrador | Não é listado aos outros perfis. |
| Remover da biblioteca | Administrador | O metadado, a chave interna e todas as referências são removidos; sem chave não existe rota ou UI que consiga chegar ao objecto no storage gerido. A retenção física subjacente obedece à política do fornecedor corporativo. |

### Validação fim-a-fim sem dados de negócio

Em 10 de setembro de 2026 foi criado por procedimento administrativo um PDF QA válido, sem conteúdo pessoal ou operacional, sob o título `QA_DOCUMENT_LIBRARY_20260910`, em **Certificações → LEED**. O perfil EE autorizado visualizou-o na biblioteca e abriu-o com sucesso pela rota privada autenticada. A suite comportamental confirma em runtime a consulta para EE, Dono de Obra, PM e RAA; confirma ainda que EEP, RAP e Observador são recusados antes da listagem e que a rota privada de PDF devolve `403` a um perfil não autorizado antes de consultar metadados.

No fim da validação, o registo QA, a chave armazenada na base de dados e os eventos de auditoria QA foram removidos. Não ficou nenhum documento de teste listável, acessível pela rota da aplicação ou com chave de storage disponível na base de dados.

## Configuração obrigatória pela Start Campus antes de produção própria

A equipa IT deve configurar a base de dados com cópias cifradas, retenção e restauro testado; activar monitorização e alertas de disponibilidade; restringir SSH, painel de gestão e acesso à base de dados; guardar os segredos num cofre de credenciais; aplicar actualizações de segurança; e estabelecer WAF/CDN e protecção anti-DDoS. Deve também definir uma política de retenção e eliminação física para anexos removidos da biblioteca, quando o armazenamento SharePoint/S3 definitivo estiver integrado.

O repositório GitHub deve ter revisão obrigatória e CI/CD com análise de dependências antes de qualquer publicação. A protecção de branch não foi activada através da API nesta validação porque requer uma subscrição/configuração administrativa do GitHub da organização; este passo continua obrigatório antes de delegar alterações a terceiros.
