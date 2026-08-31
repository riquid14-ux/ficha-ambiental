# Validação — remoção de mapas e descrições KPI

## Objectivo

Registar a validação da decisão de retirar o módulo de Mapa da versão activa e de tornar as descrições dos campos KPI claras quanto ao valor, projecto, empresa e período a reportar.

## Evidência visual

Numa sessão administrativa HTTPS, com o projecto **SIN02** seleccionado, o menu apresentou apenas **Bem-vindo, Dashboard, Calendário, Timeline, Ficha Semanal, Gestão de Resíduos, KPI's** e **Administração**. Não foi apresentada qualquer entrada, rota ou cartão de Mapa.

Na área **KPI's > Submeter**, foram confirmadas as categorias **Geradores** e **Qualidade do Ar e Ruído**. Os cartões exibiram descrições concretas no contexto seleccionado; por exemplo: “Número de trabalhadores em obra no projecto SIN02, da empresa SC, na semana 36/2026.” e “Total de horas trabalhadas no projecto SIN02, da empresa SC, na semana 36/2026.”

| Elemento | Resultado |
|---|---|
| Menu do projecto | Sem entrada Mapa. |
| Rotas e procedimentos | Não existem rotas do cliente nem procedimentos tRPC activos para `projectMap`; a rota histórica `/mapa` devolve 404. |
| Dados cartográficos | As quatro tabelas de mapas estavam vazias e foram removidas após confirmação expressa. |
| Dependências | Removidos os pacotes exclusivos `exifr` e `@types/google.maps`. |
| Descrições KPI | Sem a instrução genérica “Registe”; cada uma identifica o valor em causa e o contexto de reporte. |
| Futuro | NodeODM fica apenas descrito em [`FERRAMENTAS_FUTURAS.md`](./FERRAMENTAS_FUTURAS.md), sem activação na aplicação. |

> Não foram gravados dados de QA, ficheiros de levantamento, palavras-passe ou outros elementos sensíveis durante esta validação.
