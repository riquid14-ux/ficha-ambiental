# Feedback Findings Summary - Rita Monteiro UAT Review (Aug 2026)

## CRITICAL (Must Fix)
1. **GAMMA-01**: GAMMA page crashes (Download icon not defined) - REMOVE from menu
2. **NAV-01**: Switching project mode strands user on orphan page - add route guard
3. **FLOW-01**: Unreviewed DRAFT data counted as compliance on Dashboard - ONLY approved fichas should count
4. **FLOW-02**: Approval does NOT update Fases progress (11/18 stays same after approval)
5. **FLOW-03**: Approved ficha never appears in Matriz (DO has no row)
6. **FLOW-04**: Same user can submit AND approve own ficha - no separation of duties
7. **RBAC-00**: ALL 9 users are Admin - no role enforcement tested
8. **RBAC-05**: Email invites not being delivered - onboarding broken
9. **GOV-01**: Platform hosted on Manus - data governance questions (analytics, CDN)

## HIGH Priority
10. **NAV-02**: No visual signal that menu changes with project selector
11. **NAV-03**: "Matriz" means 3 different things, "Dashboard" means 2
12. **NAV-05**: Objects not clickable (Matriz cells, company rows, timeline phases)
13. **DATA-01**: SIN01 shows different phase on Dashboard vs Timeline
14. **DATA-07**: RAA role defined but no company exists for it - workflow can't complete
15. **TL-01**: No dates on Timeline - no today marker, no schedule
16. **RDCD-03**: Per-measure history exists but not linked from RDCD/Fases/Matriz
17. **RDCD-05**: Plans not pre-selected from frequency/period
18. **PLN-01**: All 20 plans have no dates - page is inert
19. **FLOW-05**: DO can create fichas but shouldn't (contradicts workflow)
20. **FLOW-06**: Submit gives NO feedback (no toast, no confirmation)
21. **FLOW-07**: Weekly ficha asks about ALL phases including future ones (~194 measures)
22. **FLOW-08**: Timeline dates should drive which measures appear in ficha
23. **AUTH-04**: "Criar conta" publicly available - verify pre-approval is truly inert
24. **SEC-01**: No password strength policy (123456 accepted)

## MEDIUM Priority
25. **NAV-04**: 4 different tab/navigation patterns across pages
26. **DATA-02**: Timeline has 8 phases, Fases has 9 (Desativação missing from Timeline)
27. **DATA-03**: Same phase has 3-4 different names across pages
28. **DATA-05**: Dashboard ficha counts don't include drafts bucket
29. **DATA-06**: Fases progress and Dashboard fichas count different things silently
30. **DATA-08**: "Próximo RDCD: 31/03" with no year
31. **FCH-01**: Print header rendering inside web page (PDF cover on screen)
32. **RDCD-04**: Step 3 of wizard has nothing to do
33. **ADM-01**: Companies don't show their people (rows not clickable)
34. **ADM-02**: Delete is ONLY action on company - no edit, no deactivate
35. **ADM-06**: No search/filter/sort on admin tables
36. **FLOW-09**: Notas do Projeto overwrites instead of accumulating
37. **FLOW-10**: Multiple smaller defects (sections not in order, duplicate names, raw slugs)

## LOW/Nice to Have
38. **NAV-06**: Project dropdown covers entire menu
39. **DATA-09**: Two week notations on same screen
40. **TL-05**: Hero images crowd out content
41. **KPI-01**: Accent colours carry no meaning
42. **ADM-05**: Raw database IDs visible
43. **AUTH-05**: Autodesk SSO should be primary option

## PROPOSALS (Rita)
- **IA-01**: Merge Dashboard + Calendário + Timeline into one time-based view
- **FLOW-08**: Timeline dates drive ficha scoping
- **FLOW-09**: Notas as append-only thread

## Key Architecture Issues
- Dashboard counts DRAFTS as compliance (CRITICAL)
- Fases and Fichas are disconnected systems
- No separation of duties enforcement
- All users are admin - permissions never tested
- Email delivery not working
