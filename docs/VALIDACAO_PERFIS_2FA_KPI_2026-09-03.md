# Validação de perfis, 2FA e KPI — 2026-09-03

## Navegação e boas-vindas

Foi validada visualmente a página **Bem-vindo** em SIN02 com perfil Administrador. Os cartões apresentados correspondem aos módulos realmente visíveis no menu lateral: Dashboard, Ficha Semanal, Gestão de Resíduos, KPI, Calendário e Timeline. Os cartões de Workflow e Fases de Exploração, que não são opções do menu de SIN02, deixaram de ser apresentados.

As regras de visibilidade foram centralizadas numa única política reutilizada pelo menu e pela página de boas-vindas. A regressão cobre EE, RAA e EEP para impedir que uma identidade veja cartões de funcionalidades inacessíveis.

Foi também validado visualmente o perfil **EE** em SIN02. O menu e os cartões mostram exactamente Ficha Semanal, Gestão de Resíduos, KPI, Dashboard Parceiros e Pedidos EEP. Dashboard, Calendário, Timeline, Fases e administração não são anunciados nem apresentados ao perfil EE.

O acesso de **JMG** foi testado após a reposição autorizada da credencial inicial e concluiu com sucesso no perfil Administrador, sem erro de palavra-passe nem pedido de 2FA durante o prazo de graça activo.

## Dois fatores

Foi aplicado a todos os 13 utilizadores um prazo de graça até **2026-10-03 14:05:26**. A extensão não desactiva TOTP para a conta que já o tinha activo e foi registada no audit trail.

## KPI

O catálogo foi reconciliado com o anexo ambiental, com nomenclaturas, unidades, metas e textos de apoio revistos. A regressão final passou com **40 suites e 429 testes**, TypeScript, build de produção, auditoria de dependências sem vulnerabilidades conhecidas e verificação de integridade do diff.

Foi exportado, sem erro, o relatório **SIN02 · S1–S36 · 2026**. O ficheiro contém as folhas **Resumo KPI** e **Detalhe semanal** e reproduz os nomes normalizados, os grupos Geradores e Qualidade do Ar e Ruído, Água reutilizada e os quatro indicadores próprios de Águas Afluentes.

## Acessos configurados

Foram confirmadas as contas activas e associadas a SIN02: JPA como Administrador; Julia Linhares como EE da GC1/TSL; Paula Quitério como PM; Ana Faustino como RAA. As credenciais iniciais foram tratadas fora do repositório e não constam deste documento.

## Publicação

A versão **4409ec8d** foi publicada e comparada com o ramo principal remoto. Os hashes local e remoto coincidem, confirmando que a versão publicada é a que passou a regressão, o build e a auditoria.
