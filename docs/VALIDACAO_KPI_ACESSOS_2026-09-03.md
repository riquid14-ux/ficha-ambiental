# Validação KPI e acessos — 03-09-2026

## Evidência funcional

No projecto **SIN02**, a sessão administrativa confirmou visualmente que o formulário KPI apresenta os nomes normalizados e as legendas operacionais do catálogo fornecido. Foram verificados os campos **Trabalhadores em projeto**, **Trabalhadores locais**, **Total horas trabalhadas** e **Técnicos de ambiente**, incluindo o contexto de projecto, empresa e semana.

Foi também confirmado o grupo **Geradores**, com os quatro indicadores solicitados e a meta `0` em **Derrames no abastecimento**. O catálogo activo mantém as categorias **Geradores** e **Qualidade do Ar e Ruído**, e os campos redundantes de combustível `Gerador` e `Equipamento` ficaram arquivados, sem valores históricos.

## Acessos configurados

As contas `jmg@startcampus.pt` e `jpa@startcampus.pt` estão activas como Administrador. As contas `julia.linhares@tslprojects.com`, `paula.quiterio@gleeds.com` e `ana.faustino@tecnoplanoconsulgal.pt` estão activas, associadas a SIN02 e obrigadas a substituir a palavra-passe inicial no primeiro acesso. Não são registadas credenciais neste documento.

## Verificações automatizadas

TypeScript e a suite de 421 testes passaram. O build de produção passou com avisos de tamanho de bundle já conhecidos. A auditoria de produção identificou quatro vulnerabilidades transitivas: `mysql2` (uma alta e uma moderada) e `qs` (duas moderadas). A publicação fica pendente da avaliação e correcção destas dependências.
