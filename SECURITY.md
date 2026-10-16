# Política de segurança

## Comunicar uma vulnerabilidade

Não abrir uma issue pública para uma vulnerabilidade, credencial exposta, possível acesso indevido, fuga de informação, falha de isolamento por projeto ou problema de autenticação.

1. Comunicar pelo canal interno de segurança ou suporte da Start Campus, com o assunto **STAND — Security report**.
2. Incluir uma descrição curta, versões/commit afetados, impacto observado e passos de reprodução mínimos.
3. **Não** incluir passwords, tokens, dados pessoais, dados de projeto, evidências, eGARs ou ficheiros reais no pedido.
4. A equipa confirma a receção, classifica o impacto e define a correção/revogação/rotação necessária.

## Limites de divulgação

A correção deve ser preparada numa branch privada ou na cópia interna da organização. Não publicar pormenores de exploração até existir uma correção validada e a equipa responsável aprovar a comunicação.

## Controlos obrigatórios

- Não reduzir RBAC, 2FA, revogação de sessão, validação de origem, sanitização de ficheiros ou limites de autenticação para resolver uma falha.
- Tratar logs, ficheiros importados, descrições de incidentes e comentários como dados não confiáveis.
- Não colocar segredos em código, issues, pull requests, logs, capturas de ecrã ou documentação.
- Executar `pnpm check`, `pnpm test`, `pnpm build` e `pnpm audit --prod` antes de propor a correção.
- Correções que afetam produção requerem revisão humana, plano de rollback e confirmação de `/api/health/ready` após deployment.

## Âmbito técnico

São prioritários: autenticação, sessões, 2FA, controlo por papel/empresa/projeto, acesso a documentos/media, uploads, integrações ACC/SharePoint/BMS, exportações, base de dados e infraestrutura de deployment.
