# Validação — KPI e Acesso PM por Projeto

## Observação visual inicial

Em 10-09-2026, a Administração foi aberta por sessão autenticada de Administrador no projeto SIN02. A interface apresentou a navegação de projeto individual, incluindo Planos, Calendário, Timeline, Ficha Semanal, Gestão de Resíduos, KPI e Documentação. A tabela de empresas confirmou que o PM GLEEDs tem âmbito configurado por projeto, sem expor credenciais ou dados de teste.

Na aba **Utilizadores**, o novo cartão **PM — Gestão de Projeto** foi renderizado e comunica explicitamente a separação entre consulta, aprovação de fichas e administração. A listagem administrativa carregou temporariamente sem utilizadores, pelo que a configuração interativa de um PM continuará a ser verificada depois da validação técnica e da confirmação da origem dos dados apresentados.

Após a atualização da consulta, a lista administrativa apresentou o PM atribuído e o respetivo botão **Configurar acesso**. A janela de configuração apresentou, por cada projeto atribuído, os módulos Dashboard, Planos, Calendário, Timeline e Fases, Fichas semanais, Resíduos, KPI e Documentação. Todos se encontravam ativos por defeito, assegurando continuidade operacional do PM existente até uma restrição explícita pela Administração.

## Critérios desta entrega

O modelo Excel KPI passa a dispor das semanas em colunas lado a lado. A gravação manual passa a enviar o retrato completo dos KPI ativos da semana. A Administração passa a disponibilizar a configuração de módulos de consulta do PM por cada projeto atribuído, sem alterar a separação de deveres relativa a aprovação e administração.

## KPI — observação visual

No projeto SIN02, a página KPI apresentou os comandos **Modelo Excel** e **Importar Excel**, bem como o período explícito de semanas inicial e final. O intervalo visível permite escolher várias semanas para gerar um ficheiro único. A estrutura de colunas semanais será confirmada pela inspeção do ficheiro descarregado antes da publicação.

O modelo descarregado foi validado como ficheiro XLSX íntegro. O cabeçalho contém **ID da métrica**, **Métrica**, **Unidade** e uma coluna por semana — começando por **Semana 1**, **Semana 2**, **Semana 3** e seguindo até ao fim do intervalo escolhido. O ficheiro transitório foi removido após inspeção.

## Validação técnica final

A compilação TypeScript, a regressão completa, o build de produção, a auditoria de dependências de produção e a verificação de diferenças foram concluídos sem erro. Permanecem apenas os avisos de dimensão de bundle já conhecidos para as bibliotecas de documentos e Excel; não foi introduzido `React.lazy` nem alterado o modo claro exclusivo. Não ficaram exportações KPI transitórias em Downloads.
