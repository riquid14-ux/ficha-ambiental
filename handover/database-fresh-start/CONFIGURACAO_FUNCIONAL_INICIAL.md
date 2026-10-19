# Configuração funcional após a baseline vazia

A baseline cria estrutura, não dados. Esta separação é deliberada: o DBA controla o esquema; a Administração STAND e a equipa Ambiental aprovam os dados de configuração.

## Sequência mínima

1. Criar o primeiro Admin com `bootstrap-initial-admin.mjs`.
2. Importar o catálogo SIN02 opcional com `import-catalogue-template.mjs`.
3. Entrar na STAND, ativar 2FA para o Admin e criar os restantes administradores por convite.
4. Criar as empresas (EE, EEP, RAA, PM, DO, RAP) e associá-las apenas aos projetos permitidos.
5. Criar projetos de construção a partir do modelo SIN02; os catálogos semanal e DCAPE são clonados de forma independente.
6. Configurar projetos sem modelo de construção (incluindo SIN01/NEST) apenas com os módulos e catálogo regulamentar aprovados pela equipa responsável.
7. Configurar KPI, metas, planos, calendário APA, destinatários, parâmetros de Operação, integrações documentais e branding através dos fluxos administrativos.
8. Realizar os testes de aceitação descritos no guia Fase 1 antes de adicionar dados reais.

## O que o importador SIN02 inclui

- um projeto-modelo SIN02;
- secções e medidas do controlo semanal (`weekly`), com responsabilidades de papel;
- secções e medidas regulamentares para Timeline/Fases (`dcape`);
- texto de referência de medidas.

## O que não inclui

- utilizadores, empresas, associações de projetos, passwords, 2FA ou sessões;
- fichas, respostas, comentários, aprovação/rejeição, KPI, resíduos, MIRR ou e-GAR;
- RDCD, planos, calendário, documentos, evidências, imagens, ficheiros ou fotografias;
- leituras, faturas, cenários, parâmetros ou telemetria BMS;
- dados demonstrativos.

Esta fronteira garante que o primeiro dado real só entra depois de a equipa responsável aprovar cada configuração e de os utilizadores terem sido atribuídos aos projetos corretos.
