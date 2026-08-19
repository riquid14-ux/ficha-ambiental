# Análise: Feedback da Rita vs Visão Original do Ricardo

## Contexto
A Rita Monteiro fez uma revisão UAT com 75 findings. Alguns são bugs reais que precisam de correcção. Outros são propostas de redesign que reflectem **a visão dela** sobre como a plataforma deveria funcionar — que nem sempre coincide com o que o Ricardo pediu e idealizou.

Esta análise classifica cada finding pendente em 3 categorias:
- **BUG REAL** — erro objectivo que precisa de correcção independentemente da visão
- **MELHORIA ALINHADA** — sugestão que melhora o que o Ricardo pediu
- **VISÃO DIFERENTE** — a Rita propõe mudar algo que o Ricardo definiu intencionalmente

---

## Findings Pendentes — Classificação

### BUGS REAIS (corrigir sem dúvida)

| ID | Finding | Porquê é bug |
|---|---|---|
| DATA-01 | SIN01 mostra fase diferente no Dashboard vs Timeline | Duas páginas contradizem-se sobre o mesmo facto — isto é um erro de dados, não de design |
| DATA-08 | RDCD mostra "31/03" sem ano | Data ambígua num contexto regulatório — erro claro |
| PLN-02 | Todos os planos mostram tick verde sem ter data | Tick verde = "tudo bem" quando nada está preenchido — informação enganosa |
| RDCD-01 | Week picker parte a semana em duas linhas | Bug de locale — a grelha é Sunday-first mas ISO weeks são Monday-first |
| RDCD-02 | Date picker do RDCD todo em inglês | Bug — "Week 32, 2026", "Su Mo Tu" debaixo de labels em português |
| DATA-05 | Dashboard não tem counter de Rascunhos | O total não bate com a soma dos estados visíveis — confuso |
| FCH-02 | "Nenhuma ficha para o período selecionado" sem período visível | Mensagem errada para o contexto |
| SEC-01 | Password "123456" aceite | Risco de segurança real (mas o Ricardo definiu como default temporário) |

### MELHORIAS ALINHADAS com a visão do Ricardo

| ID | Finding | Porquê está alinhado |
|---|---|---|
| NAV-05 | Objectos não clicáveis (Matriz cells, company rows) | O Ricardo pediu interactividade — clicar numa célula da Matriz deveria abrir a ficha |
| RDCD-03 | Histórico por medida existe mas não está linkado | O Ricardo criou o "Por Medida" — faz sentido linká-lo de onde as medidas aparecem |
| RDCD-05 | Planos não pré-seleccionados pela frequência | O Ricardo pediu que o RDCD fosse inteligente — pré-seleccionar planos devidos é exactamente isso |
| DATA-06 | Fases e Dashboard contam coisas diferentes sem dizer | Adicionar labels "16 medidas cumpridas" vs "1 ficha semanal" clarifica sem mudar nada |
| NAV-03 | "Matriz" significa 3 coisas | Renomear para "Matriz de Fichas", "Matriz KPI", "Matriz de Acompanhamento" — não muda funcionalidade, só clarifica |
| RDCD-04 | Step 3 do wizard não tem nada para fazer | Merge com step anterior — simplifica sem perder funcionalidade |
| DATA-09 | Duas notações de semana no mesmo ecrã | Padronizar para "S34/2026" — consistência visual |

### VISÃO DIFERENTE da Rita (NÃO implementar sem o Ricardo concordar)

| ID | Finding | Porquê é visão diferente |
|---|---|---|
| GAMMA-00 | "Remover GAMMA da plataforma" | O Ricardo disse explicitamente que quer manter o GAMMA. A Rita argumenta que não pertence a compliance ambiental, mas o Ricardo vê a plataforma como mais do que compliance — inclui sustentabilidade comunitária |
| IA-01 | "Merge Dashboard + Calendário + Timeline numa só página" | O Ricardo criou estas 3 páginas separadas intencionalmente. O Calendário tem a Control Room, a Timeline tem as Fases como sub-tab, o Dashboard tem os KPI cards. Fundir destruiria a organização que o Ricardo pediu |
| NAV-02 | "Nada avisa que o menu vai mudar" | O Ricardo pediu explicitamente dois modos (projecto individual vs todos). A Rita quer um toggle "Portfólio/Projeto" — é uma preferência de UX, não um bug |
| NAV-04 | "Três padrões de navegação diferentes" | O Ricardo pediu tabs diferentes em cada secção (KPI com Dashboard/Submeter/Metas, Ficha com Nova/Rascunhos/Matriz/Histórico). Uniformizar seria perder a identidade de cada módulo |
| TL-05 | "Hero images ocupam muito espaço" | O Ricardo pediu explicitamente imagens da Start Campus em cada página e quer poder ajustá-las em Admin > Imagens. A Rita prefere menos imagens — é questão de gosto |
| PLN-03 | "Planos deviam estar em modo projecto" | O Ricardo decidiu que Planos ficam em "Todos os Projetos" — é uma decisão de arquitectura, não um bug |
| TL-03 | "SIN01 tem barra diferente dos outros" | O Ricardo definiu SIN01 como OPERATION_ONLY — é intencional que não tenha as fases de construção |
| NAV-06 | "Dropdown cobre o menu" | Cosmético — funciona, é só menos elegante |

### DEPENDEM DE ACÇÃO MANUAL (não são código)

| ID | Finding | O que falta |
|---|---|---|
| RBAC-00 | Todos os 9 users são Admin | O Ricardo precisa de ir a Admin > Utilizadores e atribuir roles (EE, RAP, RAA, DO) |
| DATA-07 | Não existe empresa RAA | O Ricardo precisa de criar uma empresa RAA em Admin > Empresas |
| PLN-01 | 20 planos sem datas | O Ricardo precisa de preencher as datas em Planos (último/próximo reporting) |
| RBAC-05 | Convites por email não entregues | Depende de configuração de email do servidor de produção |

---

## Resumo Executivo

| Categoria | Quantidade | Acção |
|---|---|---|
| Já corrigidos | 16 | ✅ Feito |
| Bugs reais pendentes | 8 | Corrigir — são erros objectivos |
| Melhorias alinhadas | 7 | Corrigir — melhoram o que o Ricardo pediu |
| Visão diferente da Rita | 8 | NÃO implementar sem confirmação do Ricardo |
| Acção manual necessária | 4 | Ricardo precisa de fazer em Admin |

**Conclusão:** Dos 75 findings, 16 já estão corrigidos, 15 são melhorias reais que devemos fazer, 8 são a Rita a propor uma plataforma diferente da que o Ricardo idealizou, e 4 dependem de acção manual do admin.
