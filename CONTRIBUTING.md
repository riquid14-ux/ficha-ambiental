# Contribuir para a STAND

## Regra de trabalho

Este repositório público é uma referência de código para transferência. O IT deve trabalhar numa cópia interna protegida para configurações corporativas, dados reais e alterações de produção.

1. Abrir uma branch a partir de `main`: `feature/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`.
2. Manter o âmbito da alteração pequeno e reversível.
3. Não adicionar segredos, ficheiros `.env`, dados de pessoas, evidências, eGARs, backups, fotografias não autorizadas ou exportações reais.
4. Preservar a distinção entre fichas semanais, obrigações DCAPE e consolidação RDCD.
5. Preservar a separação de deveres: quem submete uma ficha não pode aprová-la.

## Verificação obrigatória

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm audit:i18n
pnpm test
pnpm build
pnpm audit --prod
```

Para alterações de infraestrutura, verificar também os scripts em `ops/` e documentar o respetivo procedimento de rollback.

## Pull request

Cada pull request deve indicar:

- **Problema e âmbito**;
- **Risco** para segurança, dados e operação;
- **Testes executados** e resultado;
- **Plano de rollback**;
- impacto em migrações, permissões, integrações ou documentação.

Não fazer merge de alterações de segurança, identidade, dados ou infraestrutura sem revisão independente. Para falhas de segurança, seguir [SECURITY.md](SECURITY.md) em vez de abrir uma issue pública.
