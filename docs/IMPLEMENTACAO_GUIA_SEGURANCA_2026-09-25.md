# Implementação das melhorias do Guia Técnico de Segurança, Tradução e Design

**Data:** 25 de setembro de 2026  
**Âmbito:** Plataforma de Gestão Ambiental — Start Campus  
**Estado:** Implementação local concluída, migração de dados aplicada e validação técnica aprovada.

## Enquadramento

O guia recebido foi analisado como uma revisão de arquitetura, segurança, privacidade e consistência de interface. As recomendações aplicáveis à aplicação foram incorporadas sem alterar os dados de negócio, os fluxos ambientais ou a composição congelada do cockpit NEST. As alterações concentram-se em reduzir exposição de ficheiros, reforçar a autenticação e tornar a autorização por projeto verificável no servidor.

> **Princípio aplicado:** a interface orienta o utilizador, mas a decisão de segurança é sempre tomada no servidor. Um URL, identificador, botão oculto ou estado guardado no browser não concede acesso.

## Melhorias efetivamente implementadas

| Área | Melhoria aplicada | Resultado prático |
|---|---|---|
| Ficheiros privados | O proxy `/manus-storage/*` deixou de redirecionar qualquer chave conhecida. Agora valida a sessão, resolve a chave contra a entidade persistida e confirma o âmbito de projeto, módulo e empresa antes de emitir o redirecionamento temporário. | Um URL de evidência, fatura, importação operacional, anexo de plano ou cartão não pode ser usado por outro utilizador autenticado fora do âmbito autorizado. |
| Ativos públicos | Acesso sem sessão limitado a uma lista exata de cinco imagens estáticas de marca utilizadas antes do login. | Não há “pastas públicas” implícitas nem chaves livremente enumeráveis. |
| Pesquisa de ficheiros | Foram adicionados índices de base de dados para chaves de evidência, históricos, anexos de planos, fases e operação. | A validação de permissões não degrada progressivamente com o histórico documental. |
| Sessões | Foi acrescentado `sessionVersion` a `users`. Cada token passa a transportar essa versão e a sessão é recusada quando a versão persistida muda. | Alterar palavra-passe, redefinir palavra-passe, ativar/desativar 2FA ou aprovar/rejeitar uma conta invalida sessões anteriores. |
| Duração de sessão | As novas sessões de aplicação têm duração padrão de 30 dias, em substituição do horizonte anual. | Menor exposição em dispositivos esquecidos, mantendo utilização operacional realista. |
| Cookies | Cookies de sessão mantêm `HttpOnly`, `SameSite=None`, `Path=/` e passam a falhar fechados com `Secure` em produção. | Menos risco de transmissão não segura por configuração incorreta de proxy. |
| 2FA no servidor | A regra de inscrição obrigatória após o período de graça foi movida para um módulo partilhado e aplicada nas procedures tRPC, incluindo perfis EEP. | Não é possível contornar a obrigação apenas chamando um endpoint diretamente. |
| Desafio de 2FA | O login com 2FA cria um cookie efémero, `HttpOnly`, com validade de cinco minutos. A validação TOTP exige esse desafio ligado ao mesmo utilizador e limpa-o após utilização. | Um `userId` isolado já não é suficiente para tentar validar o segundo fator de outra pessoa. |
| Desativação de 2FA | A desativação exige agora um código TOTP atual na interface e no servidor. | Evita a remoção acidental ou não confirmada do segundo fator. |
| Limites de tentativas | Mantém-se o rate limit HTTP existente e foi acrescentado um limite em memória por origem para palavra-passe e TOTP. | Reduz tentativas repetidas mesmo quando o pedido passa pela camada tRPC. A infraestrutura de produção deve manter limitação complementar no reverse proxy/WAF. |
| OAuth Autodesk | O início de OAuth Autodesk passa a criar e validar um `state` aleatório em cookie host-only. O callback usa `ADS_REDIRECT_URI` quando configurado e, em produção, não aceita um `Host` arbitrário como origem de retorno. | Mitiga CSRF e open redirect no fluxo de ligação externa. |
| SSO e contas | Contas externas desconhecidas passam a ficar pendentes; contas com 2FA ativo não recebem sessão automática Autodesk; foi removida a criação/promoção automática de administradores por email. | A criação, aprovação e promoção de acesso permanece uma ação administrativa auditável. |
| Autorização por projeto | Comentários de revisão, respostas, imagens, anexos, revisão de fichas, workflow e evidências de fases agora validam explicitamente projeto, módulo, papel e empresa no servidor. | Mitigação adicional de BOLA/IDOR em endpoints com identificadores de ficha, evidência ou projeto. |
| RDCD | A leitura agregada de respostas/evidências para RDCD ficou limitada a Administrador ou Dono de Obra. | Um PM não pode solicitar dados de fichas através de IDs arbitrários para gerar um relatório global. |
| Erros | O formatter tRPC devolve mensagem genérica em falhas internas e a interface deixou de mostrar stack traces. Os endpoints Autodesk deixaram de devolver detalhes técnicos de falhas de sessão. | Menor exposição de nomes de módulos, caminhos internos, tokens ou detalhes de implementação. |
| Idioma e tema | O documento HTML usa `lang="pt-PT"`; foi removido um resquício visual de tema escuro e substituído texto inglês visível no login. | Consistência com a política de português europeu e modo claro exclusivo. |
| Logout | Foi removida a rota `GET /api/auth/logout`; o logout passa pela mutation tRPC e limpa sessão e desafio MFA. | Elimina logout por pedido GET/cross-site e centraliza a limpeza de credenciais. |

## Migração aplicada

A migração `drizzle/0055_daffy_triton.sql` foi gerada, revista e aplicada ao TiDB. É aditiva e não elimina nem altera dados de negócio. Inclui a coluna `users.sessionVersion` e os índices necessários para a autorização eficiente de ficheiros privados.

## Validação realizada

A validação consolidada terminou com sucesso:

| Verificação | Resultado |
|---|---|
| TypeScript (`tsc --noEmit`) | Aprovado |
| Regressões Vitest | **525 testes aprovados em 56 ficheiros** |
| Testes introduzidos | Política 2FA, desafio MFA, nomes de chave de storage, lista pública estrita e rate limiting local |
| Drill OWASP/IDOR | Aprovado, incluindo a guarda central `assertSubmissionReadAccess` |
| Testes de resiliência | Aprovados |
| Build Vite de produção | Aprovado |
| `git diff --check` | Aprovado |
| Auditoria de dependências de produção | Sem vulnerabilidades conhecidas |
| Revisão visual | Modo claro confirmado no preview ativo |

O build mantém avisos de tamanho de bundle já existentes para `docx` e `exceljs`. Não são falhas de compilação nem foram tratados com uma alteração estrutural de carregamento nesta entrega, para respeitar a orientação de não reintroduzir `React.lazy` nem acrescentar complexidade desnecessária.

## Configuração ainda requerida pela equipa de TI

As alterações de código ficam prontas para publicação, mas os seguintes controlos dependem de infraestrutura Start Campus e não são alegadamente ativos até configuração externa:

| Ação da equipa de TI | Finalidade |
|---|---|
| Definir `ADS_REDIRECT_URI` no ambiente de produção para `https://ambientfich.co/api/autodesk/callback` ou para o URL canónico aprovado no Autodesk Developer Portal. | Eliminar dependência de fallback e garantir correspondência exata com o redirect registado. |
| Confirmar `ADS_CLIENT_ID` e `ADS_CLIENT_SECRET` em secret manager/variáveis de ambiente e rotacioná-los se algum valor foi exposto fora do canal seguro. | Proteção de credenciais Autodesk. |
| Configurar WAF/reverse proxy com rate limiting persistente por IP e proteção DDoS. | Complementar o limite de aplicação, que é por processo e reinicia com o serviço. |
| Configurar monitorização de logs, alertas multi-destinatário, backups e plano PM2/CI/CD descrito em `ops/README.md`. | Resiliência operacional fim-a-fim. |
| Fazer revisão periódica de permissões por projeto, funções, empresas e contas pendentes. | Garantir mínimo privilégio ao longo do tempo. |
| Manter proteção do branch principal, revisão obrigatória e análise de dependências no repositório GitHub. | Prevenir alterações não revistas antes de produção. |

## Limites deliberados

A plataforma não armazena segredos em código nem nos ficheiros de configuração versionados, mas não substitui o controlo de acesso do alojamento, do GitHub, do SharePoint/arquivo externo ou do Autodesk. O token de download continua temporário depois de autorizado; por isso, URLs de documentos não devem ser partilhados fora do período e contexto autorizados. A autorização é aplicada antes de emitir o URL e os redirecionamentos não ficam em cache, mas a proteção total depende também das políticas de expiração do fornecedor de storage.

A limitação de tentativas na aplicação é uma defesa adicional e não um substituto para um WAF. A investigação automática de crashes, backup antes da correção, aprovação humana, CI/CD e rollback necessitam das ativações de infraestrutura indicadas no plano de continuidade; o código e os testes preparados não devem ser interpretados como automação de produção já instalada.

## Conclusão

As melhorias aumentam substancialmente a defesa em profundidade da Plataforma de Gestão Ambiental sem alterar os workflows funcionais. O ponto mais relevante é a passagem de verificações predominantemente orientadas pela interface para **verificações de sessão, 2FA, projeto, módulo e proprietário no servidor**, acompanhadas de revogação de sessão, menor exposição de erros e proteção explícita dos ficheiros privados.

A publicação desta versão deve ser acompanhada pela configuração de `ADS_REDIRECT_URI`, pelos segredos corretos e pelos controlos de operação da TI. Depois dessa ativação, a equipa deve repetir os testes de acesso Autodesk, autorização por projeto e recuperação de incidente no ambiente final.
