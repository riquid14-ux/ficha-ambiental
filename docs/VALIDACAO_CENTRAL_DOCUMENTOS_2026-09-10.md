# Validação — Central de Documentos do Projeto

**Data:** 10 de setembro de 2026  
**Âmbito:** Administração e Biblioteca Documental

## Configuração administrativa

Na sessão de Administrador, a sub-aba **Documentação** apresenta a secção **Configuração da Documentação**. O formulário torna explícitos os campos obrigatórios e operacionais: **Título do documento**, **Língua de redacção**, **Tópico**, **Estado inicial**, carregamento de **PDF** até 10 MB e **Descrição de consulta**.

O mesmo formulário dispõe do marcador **Destacar na Central de Documentos do Projeto**, com explicação específica para DCAPE, PGA e restantes documentos-base. Não foram criados documentos de validação nem alterados documentos operacionais nesta observação.

## Consulta da biblioteca

Na vista de consulta, a frase de enquadramento indica explicitamente que a documentação é publicada pela **Start Campus**. A **Central de Documentos do Projeto** é apresentada acima dos tópicos gerais, com indicação clara de que DCAPE, PGA e outros documentos-base devem ser consultados antes de iniciar actividade em obra. Enquanto não existem documentos publicados, a central apresenta um estado vazio explicativo, sem expor ficheiros ou controlos administrativos.

## Validação de destaque e limpeza QA

Foi inserido transitoriamente um registo identificado por `QA_CENTRAL_DOCUMENTOS_20260910`, sem ficheiro real ou conteúdo operacional, para observar a ordenação da central e a apresentação do marcador **Obrigatório**. A Central apresentou o documento acima dos tópicos gerais, com título, descrição, língua, ficheiro e aviso de leitura obrigatória.

O registo QA e quaisquer eventos de auditoria relacionados foram removidos numa transacção logo após a observação. A consulta de confirmação devolveu `qa_documents_remaining = 0` e `qa_audit_remaining = 0`.

## Perfil EE

Com a sessão de EE activa, a navegação apresenta **Documentação** como área de consulta e não apresenta **Administração**. A vista de boas-vindas também apresenta o cartão Documentação, coerente com o menu e sem expor acções de criação, publicação, arquivo ou eliminação.

## Perfis EE e PM na Central

As sessões de **EE** e de **PM** abriram a Central de Documentos com sucesso. Em ambos os perfis, a Central surge no topo da consulta, com o mesmo enquadramento de DCAPE, PGA e documentos-base, sem campos administrativos ou operações de gestão. A visibilidade da aba é coerente com os menus próprios de cada perfil.

## Perfil RAA

A sessão de **RAA** abriu também a Central de Documentos com sucesso, com os mesmos tópicos e sem controlos administrativos. A autorização de **Dono de Obra** é validada em regressão de servidor, juntamente com EE, PM, RAA e Administração; os perfis EEP, RAP e Observador continuam excluídos antes da consulta de lista ou de PDF.

## Documento-base QA destacado

Foi criado **pelo formulário normal da Administração** um PDF QA válido, com título, descrição, língua, tópico, estado publicado, carregamento de PDF, marcador central e leitura obrigatória. Nas sessões EE, PM e RAA, a Central apresentou o mesmo documento acima dos tópicos com o marcador **Obrigatório**, a descrição, a língua, o ficheiro e a ligação de consulta privada. O título e o conteúdo eram exclusivamente de validação e foram removidos, juntamente com todos os metadados e referências acessíveis.

## Perfil Dono de Obra

Um perfil temporário de **Dono de Obra**, associado apenas a SIN02 e sem dados pessoais, iniciou sessão e abriu a mesma Central. A aba Documentação estava disponível no menu, não apresentava controlos administrativos e mostrava o documento QA destacado, obrigatório e consultável. Esta confirmação completa a prova visual para EE, PM, RAA e Dono de Obra; a Administração foi validada na configuração, carregamento e publicação do mesmo fluxo.

Após a observação, uma limpeza transaccional confirmou zero documentos QA, zero utilizadores QA, zero associações QA a projetos e zero eventos de auditoria QA. Os dois utilitários temporários de validação foram também eliminados do projeto.

## Limpeza QA

Após a validação, foram removidos o documento QA central, o perfil Dono de Obra temporário, a associação a SIN02 e os eventos de auditoria correspondentes. A confirmação transaccional devolveu zero documentos, utilizadores, associações de projeto e eventos de auditoria com os marcadores QA. A chave do objeto deixou de existir na base de dados e na interface; conforme a política do armazenamento gerido, sem chave ou referência não existe rota de consulta para o ficheiro.

## Repetição da criação pela interface

Para reforçar a prova do fluxo normal, foi criado na interface da Administração o PDF temporário `qa-central-evidencia.pdf`, com título, língua, descrição, estado **Publicado**, marcador de Central e leitura obrigatória. A listagem administrativa confirmou a criação de `QA — Central obrigatória EE e PM`, sem usar procedimentos de inserção directa.

Com esse mesmo registo publicado, a sessão EE de validação e a sessão PM de validação abriram **Documentação** e visualizaram a Central no topo, com o título, PDF, descrição e marcador **Obrigatório**. Em ambas as sessões não foram expostos controlos de criação, edição, arquivo ou eliminação.

Após a observação, a limpeza transaccional confirmou zero documentos e zero eventos de auditoria com o marcador QA. Foi também identificado e removido um único registo histórico de associação a projeto sem utilizador associado; a confirmação final devolveu zero associações órfãs. Não ficaram dados QA, contas temporárias, associações de acesso nem ficheiros temporários no projeto.
