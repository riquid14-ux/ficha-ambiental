# UAT Findings Status — Rita Monteiro Review vs Current State

## ALREADY FIXED (in this session and previous)

| ID | Finding | Status |
|---|---|---|
| FLOW-01 | Dashboard counts drafts as compliance | ✅ FIXED — only approved fichas count |
| FLOW-02 | Approving ficha doesn't update Fases | ✅ FIXED — approval updates phaseMeasureStatuses |
| FLOW-03 | Approved ficha never appears in Matriz (no DO row) | ✅ FIXED — Matriz shows all submitting entities |
| FLOW-04 | Same user can submit AND approve own ficha | ✅ FIXED — separation of duties enforced API + UI |
| FLOW-06 | Submit gives no feedback | ✅ FIXED — confirmation dialog + success toast |
| FLOW-07 | Ficha shows ALL 194 measures including future phases | ✅ FIXED — scoped to current phase with toggle |
| FLOW-09 | Notas do Projeto overwrites instead of accumulating | ✅ FIXED — append-only with timestamp |
| FLOW-10 | Raw role slugs shown | ✅ FIXED — human-readable labels |
| GAMMA-01 | GAMMA crashes with Download not defined | ✅ FIXED — imports corrected, ErrorBoundary added |
| NAV-01 | Switching project mode strands on orphan page | ✅ FIXED — route guard redirects to Dashboard |
| FCH-01 | Print header rendering inside web page | ✅ FIXED — hidden on screen, print-only |
| DATA-04 | Matriz says "por Projeto" but rows are companies | ✅ FIXED — retitled to "por Empresa" |
| ADM-02 | Delete is only action on company | ✅ FIXED — Edit + Deactivate + Delete |
| FICHA-01 | RAA review shows all 156 measures | ✅ FIXED — only shows submitted measures |
| FICHA-03 | Rejected ficha shows all measures | ✅ FIXED — only shows nok measures with toggle |
| CERT-01/02/03 | Certifications input mode doesn't match output | ✅ FIXED — redesigned all 3 (CELE/EED/LEED) |

## PARTIALLY FIXED / NEEDS MORE WORK

| ID | Finding | Status |
|---|---|---|
| DATA-01 | SIN01 different phase on Dashboard vs Timeline | ⚠️ PARTIAL — shared PHASE_DEFS created but not fully wired |
| DATA-02 | Timeline has 8 phases, Fases has 9 (missing Desativação) | ⚠️ PARTIAL — PHASE_DEFS includes Desativação but Timeline may not render it |
| DATA-03 | Same phase has three different names | ⚠️ PARTIAL — PHASE_DEFS created but not used everywhere |
| DATA-05 | Ficha counts don't reconcile (no Rascunho bucket) | ⚠️ PARTIAL — Dashboard now only counts approved, but no Rascunho counter |
| NAV-03 | "Matriz" means three different things | ⚠️ NOT FIXED — still same label in sidebar, Ficha Semanal, KPI |
| RBAC-00 | All 9 users are Admin | ⚠️ NOT FIXED — requires manual role assignment by admin |
| RBAC-05 | Email invites not delivered | ⚠️ NOT FIXED — email delivery depends on external service |

## NOT YET ADDRESSED (lower priority)

| ID | Finding | Status |
|---|---|---|
| NAV-02 | Nothing tells you menu is about to change | ❌ Not fixed |
| NAV-04 | Three different navigation patterns | ❌ Not fixed (design consistency) |
| NAV-05 | Objects not clickable (Matriz cells, company rows) | ❌ Not fixed |
| NAV-06 | Project dropdown covers entire menu | ❌ Not fixed (cosmetic) |
| DATA-06 | Fases progress and Dashboard count different things | ❌ Not fixed (labeling) |
| DATA-07 | No RAA company exists | ❌ Requires admin to create one |
| DATA-08 | RDCD date shows no year | ❌ Not fixed |
| DATA-09 | Two week notations on same screen | ❌ Not fixed |
| IA-01 | Merge Dashboard/Calendar/Timeline | ❌ Not implemented (major redesign) |
| TL-01 | No dates on Timeline | ❌ Not fixed (dates exist in settings but not on bars) |
| TL-02 | Phase labels abbreviated past legibility | ❌ Not fixed |
| TL-03 | SIN01 different bar structure | ❌ By design (operation-only) |
| TL-04 | Phase colours don't encode consistent state | ❌ Not fixed |
| TL-05 | Hero images crowd out content | ❌ Not fixed (user wants images) |
| RDCD-01 | Week picker splits week across rows | ❌ Not fixed |
| RDCD-02 | Date picker entirely in English | ❌ Not fixed |
| RDCD-03 | Measure history not linked from measures | ❌ Not fixed |
| RDCD-04 | Step 3 has nothing to do | ❌ Not fixed |
| RDCD-05 | Plans not pre-selected from frequency | ❌ Not fixed |
| PLN-01 | All 20 plans have no dates | ❌ Requires admin data entry |
| PLN-02 | Every plan shows green tick regardless | ❌ Not fixed |
| PLN-03 | Planos portfolio-only but plans are per-project | ❌ Not fixed |
| FAS-01 | Fases is best page but hardest to find | ✅ FIXED — now sub-tab of Timeline |
| FCH-02 | Empty state refers to period user never chose | ❌ Not fixed |
| SEC-01 | Password policy (123456 accepted) | ⚠️ PARTIAL — min 8 chars now but weak passwords still accepted |
| GOV-01 | Manus infrastructure visible | ❌ Infrastructure limitation |
