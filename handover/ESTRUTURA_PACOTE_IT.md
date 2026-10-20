# Estrutura do ZIP de implementação IT

O ZIP é gerado por `ops/create-it-handover-zip.sh` a partir de um commit Git limpo e validado. Não é uma cópia desorganizada da raiz do repositório: prepara uma navegação por ordem de implementação.

| Pasta no ZIP | Público | Conteúdo e ação |
| --- | --- | --- |
| `00_LEIA_PRIMEIRO/` | IT, Segurança, Ambiente | Guia Word e Markdown, manifesto, estrutura do ZIP e sequência de execução. Começar aqui. |
| `01_CODIGO_FONTE_COMPLETO/STAND/` | Desenvolvimento/DevOps | Código canónico completo e compilável: frontend, backend, schema, testes, scripts e manifests. |
| `02_FASE_1_INFRAESTRUTURA/` | Infraestruturas/DevOps/DBA | Runbook do diagrama, `ops/`, workflows GitHub, avaliação da arquitetura e mapa de módulos de Fase 1. |
| `03_BASE_DE_DADOS_FRESH_START/` | DBA/Admin STAND | Baseline única de 59 tabelas sem dados, checksum, validador, bootstrap do primeiro Admin, modelo SIN02 opcional e exemplo lógico da base. |
| `04_FASE_2_OPERACAO_BMS/` | Operação NEST/BMS/Segurança | Guia de integração HMAC, código focado de Operação e BMS e condição explícita de ativação opcional. |
| `05_DOCUMENTACAO_FUNCIONAL/` | Ambiente/RAA/PM/IT | Limites e fluxos funcionais: ficha semanal vs. DCAPE, RDCD, KPI, documentos e itens futuros. |
| `06_GOVERNANCA_E_VALIDACAO/` | Segurança/DevOps | Política de segurança, contribuição, licença e materiais de resiliência/aceitação. |

## Ordem de instalação

1. Confirmar hash do ZIP e ler `00_LEIA_PRIMEIRO/COMECE_AQUI.md`.
2. Instalar a aplicação usando `01_CODIGO_FONTE_COMPLETO/STAND/` e as instruções da Fase 1.
3. Preparar as VMs e serviços com `02_FASE_1_INFRAESTRUTURA/`.
4. Aplicar a base **apenas** por `03_BASE_DE_DADOS_FRESH_START/`; não usar a cadeia histórica em `01.../drizzle/` para uma base nova.
5. Configurar SharePoint, ACC e SMTP em staging, com segredos no cofre corporativo.
6. Passar a produção depois da aceitação de Fase 1.
7. Avaliar e ativar `04_FASE_2_OPERACAO_BMS/` apenas numa alteração posterior, aprovada por Operação, BMS e Segurança.

## Integridade e exclusões

O pacote leva `SHA256SUMS.txt` para os ficheiros internos e um checksum SHA-256 do próprio ZIP. Exclui por desenho `.env`, certificados, chaves, passwords, tokens, logs, dumps, `node_modules`, builds locais, uploads e dados de produção.
