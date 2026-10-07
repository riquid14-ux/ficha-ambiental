# Separação da Ficha Semanal e do DCAPE

**Data:** 7 de outubro de 2026  
**Âmbito:** projetos de obra; SIN01 mantém o modelo OPS próprio.

## Decisão de modelo

A plataforma passa a manter dois catálogos independentes por projeto:

| Catálogo | Finalidade | Origem | Quem atua |
|---|---|---|---|
| `weekly` | Ficha semanal de controlo | Modelo Word de ficha semanal (156 linhas) | EE/RAP/DO preenchem o respetivo âmbito; RAA revê; Admin/DO têm governação administrativa |
| `dcape` | Timeline, fases e acompanhamento regulatório | Obrigações DCAPE por fase do ciclo de vida | Responsáveis, suporte e Administração atualizam o acompanhamento por fase |

> Aprovar uma ficha semanal **não** altera, conclui ou aprova uma obrigação DCAPE na Timeline.

## Regras que ficam aplicadas

1. A página **Ficha Semanal**, a revisão, a matriz, o histórico, a importação e os PDFs formais pedem exclusivamente secções e medidas com `catalogueScope = weekly`.
2. A Timeline, Fases, relatório de transição e respetivos PDFs pedem exclusivamente `catalogueScope = dcape`.
3. As respostas, pré-preenchimento e anexos de uma ficha são validados no servidor contra a medida semanal pertencente ao mesmo projeto.
4. As medidas `PL-*`, `SL-*`, `PC-*`, `CC-*`, `FC-*`, `DA-*` e `EX-*` são obrigações DCAPE e não podem integrar uma resposta semanal.
5. O fluxo de revisão mantém a separação de deveres: quem submete não aprova a sua própria ficha; RAA/Admin/DO seguem as regras server-side já existentes.
6. Novos projetos recebem cópias independentes do template SIN02 apenas para os módulos ativados: **Ficha** cria o catálogo semanal; **Timeline** cria o catálogo DCAPE. Não são copiadas fichas, respostas, evidências ou estados.
7. A superfície de Ficha, Revisão, Histórico e curadoria de obra do RDCD mostra texto de **Controlo Semanal**: remove o prefixo legado `Medida DCAPE -`, usa grupos semanais legíveis e mantém a descrição regulamentar apenas como texto de origem, não como identidade do workflow.

## Migração

A migração `0068_separate_weekly_dcape_catalogues.sql` adiciona o campo explícito `catalogueScope` às secções e medidas, cria índices por âmbito e separa os elementos regulatórios dos elementos do modelo semanal. A migração `0069_clean_measure_presentation_prefixes.sql` remove exclusivamente o prefixo de apresentação legado nas descrições; não modifica identificadores, âmbitos, respostas, evidências, estados ou registos de auditoria. O histórico de fichas, respostas, evidências e revisões é preservado.

Foi também removido apenas um registo UAT reconhecível (`TESTE UAT (Claude/Rita)`) que tinha sido associado por engano a `PC-1`, uma obrigação DCAPE. Não foram eliminadas respostas operacionais nem histórico de utilizadores.

## Verificações executadas

- Verificação de dados ativa: **0** respostas ligadas a medidas fora de `weekly`.
- Verificação de dados ativa: **0** estados DCAPE automáticos com origem `Aprovado via ficha`.
- SIN02 visualmente validado: cabeçalho da Ficha Semanal sem etiqueta DCAPE e matriz semanal apresentada apenas com os estados de fichas.
- Regressões focadas: responsabilidade por papel, PDF semanal, catálogo DCAPE, RDCD e hardening de segurança.
- Suite integral: TypeScript, auditoria PT/EN, 595 testes, build e auditoria de dependências.

## Limite deliberado

A Ficha Semanal pode ser usada como fonte aprovada de evidência no RDCD de obra, mas isso é uma compilação editorial rastreável de respostas semanais aprovadas. Não equivale a atualizar automaticamente o estado regulamentar da Timeline DCAPE.
