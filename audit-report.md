# Relatório de Auditoria — Plataforma de Gestão Ambiental
## Data: 19 Agosto 2026

---

## RESUMO EXECUTIVO

A plataforma está funcional e operacional. Todas as páginas carregam sem crashes (zero erros na consola). Os fluxos principais (criar ficha, submeter, aprovar) funcionam. No entanto, existem áreas que uma auditora como a Rita identificaria:

---

## FALHAS ENCONTRADAS

### CRÍTICAS (bloqueiam auditoria)

| # | Página | Problema | Impacto |
|---|--------|----------|---------|
| C1 | Admin | `companies.delete` TS error — o botão de eliminar empresa pode falhar em runtime | Admin não consegue eliminar empresas |
| C2 | Todas | Dark mode parcial — o toggle existe mas muitas secções internas (cards KPI, gráficos) não mudam | Impressão de produto inacabado |
| C3 | Todas | Tradução EN incompleta (~40% das strings ainda em PT) | Funcionalidade prometida não entregue |

### ALTAS (visíveis imediatamente)

| # | Página | Problema | Impacto |
|---|--------|----------|---------|
| A1 | Planos | Todos os 20 planos mostram "Último: —" e "Próximo: —" (sem datas) | Página parece vazia/inútil |
| A2 | Dashboard | SIN03-SIN07 e SUB400 mostram "Sem data" — nenhum projecto tem datas de fase definidas | Compliance tracking não funciona |
| A3 | Timeline | Todos os projectos (excepto SIN01/SIN02) mostram "Pré-Licenciamento" como fase actual | Dados não reflectem realidade |
| A4 | Calendário | Eventos mostram datas em 2027 (149d, 224d) — parecem placeholder | Não reflecte reporting real |
| A5 | RDCD | Wizard funciona mas step 2 usa input type="week" nativo (inglês, Domingo-first) | Inconsistência com pt-PT |
| A6 | GAMMA | Scorecard e Vencedores estão vazios | Funcionalidade sem conteúdo |
| A7 | KPI | Dashboard vazio (0 em tudo) — nenhum dado submetido | Funcionalidade sem demonstração |

### MÉDIAS (encontradas com uso normal)

| # | Página | Problema | Impacto |
|---|--------|----------|---------|
| M1 | Dashboard | "Fases dos Projetos" chart usa cores sem legenda clara | Difícil interpretar |
| M2 | Matriz | Matriz vazia quando não há fichas submetidas — sem empty state explicativo | Confusão |
| M3 | Workflow | Só acessível em projecto individual — redireciona para Dashboard em "Todos" | Inconsistência |
| M4 | Certificações | Só acessível em SIN01-NEST — não há indicação disso na sidebar | Confusão |
| M5 | Admin > Imagens | Imagens carregadas mas posição "center" não ajusta bem em todos os banners | Visual inconsistente |
| M6 | Perfil | Campo "Cargo" e "Nome Completo" existem mas não são obrigatórios | Dados incompletos |
| M7 | Login | Botão "Autodesk Construction Cloud" pode confundir utilizadores que não usam ACC | UX |

### BAIXAS (polish)

| # | Página | Problema |
|---|--------|----------|
| B1 | Sidebar | Nome truncado "Plataforma d..." — deveria mostrar "PGA" ou ícone |
| B2 | Dashboard | Gráfico "Evolução Semanal" com eixo Y de 0 a 1.75 (não faz sentido para fichas) |
| B3 | Timeline | Badge "SINO" em vez de "SIN0" — typo no código |
| B4 | Planos | Ícone de warning (⚠️) amarelo mas sem tooltip explicativo |
| B5 | Footer | Aviso "all documentation must be written in Portuguese" aparece em PT mesmo no modo EN |

---

## RECOMENDAÇÕES PRIORITÁRIAS

1. **Preencher dados de demonstração** — Definir datas nas fases de pelo menos 2 projectos, submeter 2-3 fichas de exemplo, e preencher 1 plano com datas reais. Isto resolve A1, A2, A3, A6, A7.

2. **Remover Dark Mode e EN do menu** até estarem completos — é melhor não oferecer do que oferecer partido. Resolve C2 e C3.

3. **Criar empresa RAA** e atribuir roles correctos — sem isto, o workflow de aprovação não pode ser demonstrado.

4. **Corrigir o RDCD week picker** — substituir input nativo por dropdown pt-PT (já parcialmente feito).

---

## ESTADO GERAL

- **Páginas funcionais**: 22/22 (100%)
- **Crashes/Erros runtime**: 0
- **Testes unitários**: 19/19 passam
- **Performance**: Rápida (build 16s, page load <2s)
- **Segurança**: Auth com password + 2FA, separação de funções, roles RBAC
- **Mobile responsive**: Parcial (sidebar colapsa, mas tabelas não adaptam)
