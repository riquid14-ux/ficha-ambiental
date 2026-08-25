# Resiliência Operacional e Recuperação Automática

Este documento descreve a protecção preparada para o servidor próprio da Start Campus. Os componentes estão no repositório, mas **não ficam activos apenas por clonar o código**: o IT deve configurar o servidor, os destinatários, os secrets GitHub e a aprovação do ambiente `production`.

## Objectivo

Evitar que uma falha repetitiva dependa da disponibilidade de uma única pessoa. A IA pode investigar e preparar uma proposta, mas nunca pode aprovar, fazer merge ou publicar automaticamente.

## Duas modalidades suportadas

| Modalidade | Componentes | Adequação |
|---|---|---|
| Protecção essencial | PM2, vigia systemd, backup validado e alertas para vários responsáveis | Pode ser activada imediatamente no servidor |
| Recuperação completa | Protecção essencial + incidente GitHub + proposta Claude + PR revisto + CI/CD + health check + rollback | A disponibilidade de required reviewers em repositórios privados depende do plano GitHub contratado.[1] [2] |

## Fluxo da recuperação completa

1. PM2 tenta recuperar a aplicação.
2. O serviço systemd `plataforma-watchdog` observa o contador de reinícios do PM2.
3. Três reinícios em cinco minutos, ou estado `errored`, criam um incidente deduplicado.
4. Antes de notificar ou corrigir, é criado um dump MySQL consistente, comprimido e validado com SHA-256. Se o backup falhar, qualquer rollback automático fica bloqueado.
5. Logs completos ficam apenas no servidor, num directório com permissões restritas. Para email/GitHub segue apenas um excerto sanitizado.
6. Pelo menos dois destinatários recebem o alerta por email.
7. O vigia emite `repository_dispatch` para o GitHub e o workflow abre uma issue auditável.
8. Claude analisa a issue como conteúdo não confiável e pode abrir um PR mínimo. Nunca faz merge nem deployment; o fluxo segue o modelo de proposta em pull request documentado pelo Claude Code Action.[3]
9. O branch `main` exige PR, CI verde e aprovação de outra pessoa.
10. Uma pessoa autorizada inicia manualmente `Deploy Production`; o job aguarda ainda a aprovação do environment `production`, cujos secrets só ficam disponíveis depois da aprovação.[2]
11. O workflow cria novo backup, instala uma release versionada e muda o symlink `current` de forma atómica.
12. `/api/health/ready` verifica processo e base de dados. Se falhar, o script repõe a release anterior e volta a verificar. Se o vigia detectar um crash-loop posterior e existir uma release anterior válida, pode também recuperá-la automaticamente.

## Componentes entregues

| Ficheiro | Responsabilidade |
|---|---|
| `ecosystem.config.cjs` | Configuração PM2 com limites de reinício, backoff e memória |
| `ops/pm2-crash-watchdog.mjs` | Detecção de crash-loop e captura de incidente |
| `ops/backup-database.sh` | Dump transaccional, gzip, checksum e retenção |
| `ops/notify-incident.mjs` | Email redundante e dispatch GitHub |
| `ops/deploy-release.sh` | Release imutável, backup, health check e rollback |
| `ops/rollback-to-previous.sh` | Backup obrigatório e reposição automática da última release anterior validada |
| `ops/verify-health.sh` | Repetição controlada do readiness check |
| `ops/systemd/plataforma-watchdog.service` | Serviço independente do PM2 |
| `.github/workflows/ci.yml` | TypeScript, testes, build e auditoria crítica |
| `.github/workflows/incident-triage.yml` | Issue e proposta Claude em PR |
| `.github/workflows/production-deploy.yml` | Deployment aprovado, verificado e reversível |
| `CLAUDE.md` | Limites obrigatórios para propostas da IA |

## Preparação do servidor

O servidor deve ter Node.js 22, pnpm, PM2, MySQL client, `mysqldump`, curl, Nginx e systemd. A conta de serviço recomendada é `plataforma`, sem login interactivo e sem acesso root.

```bash
sudo mkdir -p /opt/plataforma-ambiental/{releases,incoming}
sudo chown -R plataforma:plataforma /opt/plataforma-ambiental

cd /opt/plataforma-ambiental/current
sudo bash ops/install-watchdog.sh
sudo nano /etc/plataforma-ambiental/watchdog.env
sudo systemctl start plataforma-watchdog
sudo systemctl status plataforma-watchdog
```

O ficheiro `/etc/plataforma-ambiental/app.env` contém as variáveis da aplicação. O ficheiro `/etc/plataforma-ambiental/watchdog.env` contém apenas a configuração do vigia. Ambos devem ter permissão `600` e nunca entrar no Git.

## Destinatários e continuidade de férias

`INCIDENT_EMAIL_RECIPIENTS` aceita vários endereços separados por vírgula. Deve conter uma lista de distribuição corporativa e pelo menos um suplente. Não usar um único endereço pessoal.

Exemplo:

```env
INCIDENT_EMAIL_RECIPIENTS=apoioamb@startcampus.pt,operacoes-it@startcampus.pt,responsavel-suplente@startcampus.pt
```

## GitHub — branch e ambiente protegidos

No repositório privado final:

1. Criar o environment `production` em **Settings → Environments**.
2. Adicionar pelo menos dois required reviewers e activar **Prevent self-review**.
3. Desactivar o bypass de administradores, se a modalidade GitHub contratada o permitir.
4. Limitar deployment ao branch `main`.
5. O workflow de produção é exclusivamente manual (`workflow_dispatch`) para não publicar apenas por existir um merge.
6. Adicionar os secrets do environment:

| Secret/variável | Conteúdo |
|---|---|
| `PRODUCTION_SSH_PRIVATE_KEY` | Chave dedicada, sem reutilizar chaves pessoais |
| `PRODUCTION_SSH_KNOWN_HOSTS` | Resultado verificado de `ssh-keyscan` |
| `PRODUCTION_HOST` | Host/IP do servidor |
| `PRODUCTION_USER` | Utilizador sem privilégios root |
| `PRODUCTION_HEALTH_URL` | Variável: `https://ambientfich.co/api/health/ready` |
| `ANTHROPIC_API_KEY` | Secret apenas do workflow Claude, se esta modalidade for escolhida |

No branch `main`, exigir:

- Pull request antes de merge;
- uma aprovação e aprovação do último push por outra pessoa;
- invalidar aprovações antigas quando há novos commits;
- status check `CI / verify`;
- resolução das conversas;
- bloquear force-push e eliminação do branch;
- aplicar as regras também a administradores.

Depois de o workflow CI ter corrido pelo menos uma vez e o check `verify` existir, um administrador pode aplicar a regra base com:

```bash
GITHUB_REPOSITORY=ORGANIZACAO/REPOSITORIO \
  bash ops/configure-github-protection.sh ORGANIZACAO/REPOSITORIO --confirm
```

O script não configura os required reviewers do environment porque essa selecção depende das identidades/equipas reais da Start Campus e deve ser confirmada manualmente pelo IT.

## GitHub App / token do vigia

Preferir uma GitHub App dedicada ou token fine-grained com acesso apenas ao repositório final e à acção necessária para `repository_dispatch`. Não reutilizar tokens pessoais. Guardar o token somente em `/etc/plataforma-ambiental/watchdog.env`.

## Claude

O workflow usa `anthropics/claude-code-action@v1`. O IT deve instalar a Claude GitHub App e criar o secret `ANTHROPIC_API_KEY`, ou adaptar o workflow para Microsoft Foundry com OIDC seguindo a documentação oficial.[3] O modelo nunca recebe o log completo, apenas o excerto sanitizado; os logs completos permanecem no servidor.

## Testes de aceitação do IT

Executar primeiro num ambiente de staging:

| Teste | Resultado obrigatório |
|---|---|
| Parar a aplicação três vezes em cinco minutos | Um incidente, não três; backup criado; vários emails enviados |
| Inserir token fictício no log | O token aparece como `[REDACTED]` no email/issue |
| Claude propõe correcção | Apenas PR; nenhum merge ou deployment automático |
| Rejeitar aprovação do environment | Nada é publicado |
| Forçar `/api/health/ready` a devolver 503 | Deployment falha e a release anterior é reposta |
| Restaurar o backup em staging | Dump descomprime, checksum valida e dados abrem correctamente |

Nunca executar o teste de crash-loop directamente em produção antes de concluir estes ensaios em staging.

## Limites actuais

- O vigia só corre no servidor Start Campus; não corre no hosting gerido actual.
- A configuração GitHub depende da modalidade contratada e das identidades dos revisores.
- A IA reduz o tempo de diagnóstico, mas não substitui a validação técnica humana.
- Um backup não está comprovado até ser restaurado com sucesso num ambiente isolado.

## Referências

[1]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule "GitHub Docs — Managing a branch protection rule"
[2]: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment "GitHub Docs — Managing environments for deployment"
[3]: https://code.claude.com/docs/en/github-actions "Claude Code Docs — GitHub Actions"
