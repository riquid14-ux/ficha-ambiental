# Auditoria de segurança e usabilidade — STAND

**Data:** 5 de outubro de 2026  
**Âmbito:** isolamento por projeto/empresa, RBAC, sessão, autenticação, 2FA, exportações, ficheiros, relatórios, navegação e experiência de utilização.  
**Nota:** este documento descreve controlos verificados no código e em testes automatizados. Não é uma certificação independente, pentest externo ou garantia absoluta de ausência de vulnerabilidades.

## Resumo executivo

A revisão encontrou pontos de endurecimento que foram corrigidos nesta ronda, sobretudo no isolamento de dados entre projetos, nas exportações e nas sessões com palavra-passe temporária. O princípio aplicado é simples: **a navegação visual não basta**; o servidor volta a confirmar papel, empresa, projeto e módulo antes de ler, alterar ou exportar informação.

Foram também criados dados de demonstração reversíveis para tornar os fluxos visíveis. Estes registos estão marcados como demonstração, usam a empresa `DEMO-STAND` e/ou o marcador `[DEMO STAND REMOVÍVEL]`, e são removidos por:

```bash
pnpm seed:demo -- --remove
```

## Controlos verificados e reforçados

| Área | Controlo | Estado nesta ronda |
|---|---|---|
| Autorização | RBAC no servidor por papel, empresa, projeto e módulo; a UI é apenas uma camada adicional | Verificado por regressões de funções, navegação e fases |
| Isolamento de dados | Leituras analíticas passam a receber explicitamente os projetos autorizados; medidas e secções não são agregadas fora desse âmbito | Reforçado |
| Fichas semanais | Pré-preenchimento, respostas, revisões e anexos validam que a medida pertence ao projeto da ficha | Reforçado |
| Aprovação | Quem submete não pode aprovar a própria ficha | Coberto por regressão de funções |
| EEP | A EEP vê apenas KPI/resíduos autorizados e não herda projetos fora da EE principal | Coberto por regressão de navegação/RBAC |
| Planos | Planos universais só na visão global; edição do reporte APA só por administrador | Coberto por regressões de Planos |
| PDF/Word | A exportação confirma o âmbito de cada ficha antes de construir o documento | Reforçado |
| Imagens externas para PDF | Apenas HTTPS; bloqueio de localhost/intervalos IPv4 privados, tempo limite de 5 s e máximo de 8 MB | Reforçado |
| Upload legado | Endpoint legado desligado (410); os fluxos ativos usam os contratos privados e autorizados | Reforçado |
| Sessões | Logout revoga a sessão; mutações autenticadas com `Origin` verificável são aceites apenas a partir da origem servida | Reforçado |
| Palavra-passe temporária | A alteração obrigatória é imposta no servidor e no cliente antes de abrir a app | Reforçado e verificado em navegador |
| Recuperação | Token de recuperação é guardado apenas como hash SHA-256 e comparado com `timingSafeEqual` | Reforçado |
| 2FA | Inscrição obrigatória após período de tolerância; desafio MFA vinculado ao utilizador | Coberto por regressão |
| Ficheiros privados | Chaves perigosas são recusadas; ativos públicos de marca seguem lista explícita | Coberto por regressão |

## Exercícios de controlo executados

### Regressões de segurança e acessos

Foram executados os seguintes grupos dirigidos:

- `server/security-hardening.test.ts` — 10 testes;
- `server/roles.test.ts` — 22 testes;
- `server/role-navigation.test.ts` — 5 testes;
- `server/project-phase-tracking.test.ts` — 15 testes;
- `server/monitoring-plans.test.ts` — 28 testes.

**Resultado:** 5 ficheiros / **80 testes aprovados**.

A cobertura confirma, entre outros, que:

1. uma EE/RAP não lê fichas de outra empresa;
2. a EEP não recebe módulos fora do seu âmbito;
3. RAA e papéis não administrativos não acedem à visão transversal de fases;
4. PM respeita módulos e projetos atribuídos;
5. operações de Administração continuam reservadas a administrador;
6. relatórios de transição trazem pendências, responsável, suporte e último update sem criar calendário indevido;
7. planos e ciclos APA conservam o histórico e não duplicam eventos por plano;
8. autenticação, MFA, uploads e exportações mantêm as guardas acima descritas.

### Idioma e integridade de interface

- Auditoria de literais: **0** literais PT potencialmente expostos fora de `t()`;
- Cobertura estática: **1288** literais extraídos, **1799** traduções mapeadas, **1** exclusão regulamentar explícita.

Esta auditoria é estática; não substitui a revisão humana de todas as frases regulatórias, documentos Word/PDF e emails antes da produção.

### Revisão de usabilidade

| Percurso | Resultado | Observação |
|---|---|---|
| Login com sessão de palavra-passe temporária | Corrigido e revisto no navegador | A página abre o formulário de alteração; já não entra em ciclo de redireção para Bem-vindo |
| Navegação de papéis | Regressões aprovadas | O menu é reduzido por papel, projeto e módulos; o servidor mantém a verificação independente |
| Planos / comunicação APA | Regressões aprovadas | A timeline anual distingue ocorrência de calendário, receção, janela de 3 meses, agrupamento RDCD/anual e submissão autónoma quando não existe comunicação no intervalo |
| RDCD | Fluxos existentes preservados | Curadoria, estúdio de capítulos, figuras, tabelas e preview permanecem sujeitos à autorização do projeto |

## Limites e próximos passos responsáveis

1. O controlo de origem protege mutações de browser com cabeçalho `Origin`. Integrações servidor-a-servidor devem continuar a ter uma autenticação própria e contratos explícitos; não devem depender do browser.
2. Recomenda-se uma revisão externa periódica antes da produção (pentest autenticado, verificação de configuração do reverse proxy, TLS/HSTS, backup/restore e rotação de segredos).
3. A matriz PT/EN e claro/escuro precisa de testes E2E de browser automatizados em todas as rotas; este repositório ainda não entrega um relatório Playwright/axe completo a zero.
4. O conteúdo demonstrativo não deve ser confundido com registos medidos/aprovados. Antes de produção ou apresentação com dados reais, executar a remoção indicada acima.
5. A alteração de palavra-passe temporária é deliberadamente bloqueante. A revisão visual de módulos autenticados exige concluir essa alteração com a credencial legítima, não devendo ser contornada durante QA.
