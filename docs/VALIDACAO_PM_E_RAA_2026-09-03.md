# Validação — PM como Entidade e acesso RAA

## PM como tipo de entidade

Na Administração, o formulário **Criar Nova Empresa** mostra agora a opção **PM — Gestor de Projeto** no selector de tipo. O painel de tipos de entidade apresenta também o âmbito de PM: acompanhamento do projeto, calendário, timeline e indicadores dentro dos projetos atribuídos.

Foi executada uma criação transaccional de uma entidade PM de QA: o registo persistiu com o tipo `pm` e foi removido imediatamente no mesmo fluxo. A verificação final confirmou **0 registos QA remanescentes**. O tipo é intencionalmente definido na criação e permanece imutável depois, tal como para EE, EEP, RAP, RAA, Dono de Obra e Observador.

Para validar o fluxo real, um Administrador criou pela interface a entidade `[QA TEMPORÁRIA] PM — Remover`, com sigla `QA-PM-UI` e âmbito SIN02. A empresa surgiu na tabela administrativa com o tipo **PM** e associação a SIN02. Em seguida, a entidade, a associação de projecto e o evento de auditoria foram eliminados de forma transaccional; a confirmação final devolveu zero empresas e zero associações QA remanescentes.

A página de Administração foi recarregada após a limpeza e voltou a listar apenas as cinco entidades reais de SIN02, sem a entidade de QA.

Foi acrescentada uma regressão comportamental que invoca o procedimento administrativo de actualização e confirma que qualquer tentativa de alterar `companyType` depois da criação é rejeitada, incluindo a transição de uma entidade PM para outro tipo. A regra devolve a mensagem: “O tipo de empresa não pode ser alterado. Crie a empresa com o tipo correcto.”

## Conta RAA

A conta `ana.faustino@tecnoplanoconsulgal.pt` foi confirmada como activa, com papel **RAA**, associada à entidade Tecnoplano Consugal e aos dois projetos dessa entidade. A autenticação com a credencial inicial autorizada foi validada e a interface mostrou apenas as áreas permitidas: Ficha Semanal, Gestão de Resíduos e KPI. A credencial não foi registada neste documento nem no repositório.
