# RDCD — implementação estruturada na Plataforma STAND

**Data:** 30 de setembro de 2026  
**Estado:** Implementado para rascunho, compilação e exportação Word; emissão continua sujeita a validação humana.

## Objetivo

O módulo RDCD passou a suportar a preparação integral de um **Relatório de Demonstração do Cumprimento da DCAPE**, mantendo o princípio de que a plataforma organiza e rastreia fontes, mas não aprova nem assina automaticamente um relatório.

Cada relatório corresponde a **um único projeto** e preserva um rascunho editorial auditável. As fichas semanais, evidências e e-GARs continuam a ser os registos de origem nos respetivos módulos.

## Fluxo de trabalho

| Etapa | Operação | Fonte / controlo |
|---|---|---|
| 1. Projeto | Seleção de um projeto por RDCD | Contexto de projeto e RBAC |
| 2. Período | Semanas ISO, planos de monitorização e opção de anexo e-GAR | Semanas selecionadas; dados não são estimados |
| 3. Fichas | Seleção independente de semanas por medida, notas editoriais e fotografias | Apenas fichas aprovadas; as fotos derivam das semanas selecionadas |
| 4. Conteúdo | Textos editáveis para capítulos 1, 3, 6 e 8–11, ficha técnica e perfil institucional | Rascunho RDCD auditável |
| 5. Revisão | Conferência de fichas, medidas/semanas, fotografias, planos e e-GARs antes de Word | Confirmação humana obrigatória |

## Estrutura do Word gerado

O `.docx` segue a organização do template recebido:

1. Introdução;
2. Enquadramento do projeto no TUA;
3. Ponto de situação do desenvolvimento da obra;
4. Resumo do estado das medidas DCAPE;
5. Compilação das fichas semanais selecionadas;
6. Ações corretivas e seguimento;
7. Relatórios de monitorização;
8. Questões em aberto de períodos anteriores;
9. Programa de trabalhos;
10. Reclamações e contactos com o público;
11. Conclusões;
12. Anexo I — referência às fichas aprovadas;
13. Anexo II — registo fotográfico selecionado, quando existir;
14. Anexo III — registo de resíduos e-GAR, quando selecionado.

## Compilação de fichas e fotografias

A seleção é feita **por medida** e **por semana**. Assim, uma medida pode incluir apenas a semana 22 e outra as semanas 24, 25 e 26. As fotografias apresentadas para seleção pertencem apenas às submissões das semanas que foram selecionadas para essa medida.

A seleção não modifica a ficha semanal, não move fotografias e não altera estados de conformidade. O Word indica que o conteúdo continua a precisar de revisão técnica.

### Pré-visualização documental viva

Na curadoria do Capítulo 5, existe uma consola lateral sticky com a página Word em composição. Ao selecionar uma medida, semanas, evidências ou uma nota editorial, a consola apresenta imediatamente a medida ativa, o estado, a tabela das semanas selecionadas, as observações de origem e a nota, sem alterar a ficha aprovada.

No estúdio editorial, a mesma consola acompanha o capítulo ativo. A síntese, os pontos-chave, as fontes, as ações, as tabelas e as figuras entram na composição antes da emissão. A consola é uma pré-visualização de trabalho: não substitui a revisão técnica, a validação de conteúdo nem o Word final gerado.

## Anexo e-GAR

Quando ativado, o Anexo III é criado com os e-GARs do projeto e do período ISO escolhido:

| Coluna no Word | Fonte na plataforma |
|---|---|
| ID e-GAR | `waste_egars.egarId` |
| Data de recolha | `waste_egars.date` |
| Código LER | `waste_egars.lerCode` |
| Tipo de resíduo | `waste_egars.designation` |
| Quantidade | `correctedQuantity`, quando existe; caso contrário `quantity` |
| Destino | `waste_egars.destination` |
| Empresa | Empresa associada ao e-GAR |

Não são fabricadas quantidades, códigos LER ou registos ausentes. Um período sem e-GARs gera uma tabela explícita de ausência de registos.

## Identidades institucionais

O editor permite escolher, por rascunho, três perfis:

- **Start Campus · Gleeds · Quadrante**;
- **Start Campus · Gleeds**;
- **Start Campus**.

As três marcas foram extraídas do template fornecido e colocadas em armazenamento da aplicação; não foram introduzidas em `client/public` nem nos assets compilados. A escolha do perfil é guardada no rascunho e é incorporada apenas no Word gerado. O gerador lê as marcas através de uma rota interna autenticada, com controlo de papel e projeto, e incorpora os binários no `.docx`; não depende de redirecionamentos públicos de storage.

## Rascunhos, RBAC e auditoria

- Só **Admin** e **Dono de Obra** podem consultar, guardar ou gerar rascunhos RDCD.
- O acesso é verificado de novo para o projeto em cada operação tRPC.
- Cada criação ou alteração gera um evento de auditoria com período, projeto, número do relatório e contagens de planos, medidas, fotografias e opção de resíduos.
- A tabela `rdcd_reports` guarda texto editorial e referências/seleções em JSON; **não guarda bytes de fotografias, Word, PDFs ou anexos**.
- A migração `0062_rdcd_reports.sql` cria a tabela e índices sem apagar nem alterar dados existentes.

## Limites assumidos nesta entrega

1. O Word é um dossiê de trabalho. **Não constitui assinatura, aprovação regulatória, submissão APA ou arquivo definitivo.**
2. Os campos do TUA pré-preenchidos para SIN02 têm de ser confirmados contra a versão válida antes de emissão.
3. Anexos fora das fontes atuais (por exemplo, programa de trabalhos externo, cartas ou documentação de terceiros) devem ser adicionados e validados pelo responsável no fluxo documental antes da emissão externa.
4. A plataforma não altera o estado de uma ficha, medida ou e-GAR ao gerar o RDCD.

## Validação efetuada

- Migração aplicada e tabela `rdcd_reports` confirmada na base ativa;
- Testes de acesso, rascunho, perfis institucionais, seleção por semana e fonte e-GAR;
- Verificação TypeScript;
- Auditoria estática de traduções PT/EN;
- Inspeção visual do wizard em claro e escuro.
- Exportação de controlo renderizada em PDF: capa com as marcas Start Campus, Gleeds e Quadrante efetivamente incorporadas no `.docx`.
- Validação navegada em 6 de outubro de 2026 com SIN02, S33–S40/2026: medida ativa, semana S33 e nota editorial refletidas na consola lateral; texto editorial refletido em simultâneo na composição do capítulo. Confirmados ainda os controlos de tabela, figura/fotografia e gráfico.
