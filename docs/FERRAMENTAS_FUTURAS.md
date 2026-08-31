# Ferramentas futuras — Plataforma de Gestão Ambiental

## Processamento fotogramétrico de levantamentos DJI

O módulo de mapas, fotografias aéreas e fotogrametria foi **retirado da aplicação activa em 31 de Agosto de 2026**, por decisão de produto. Não existem rotas, opções de menu, APIs da aplicação, modelos de dados activos ou processamento de imagens associados a essa capacidade.

Se a Start Campus vier a necessitar desta capacidade, deverá ser tratada como um projecto separado, com aprovação de arquitectura e segurança própria. A implementação deve usar um worker isolado, fora do processo web da Plataforma de Gestão Ambiental, para validar e processar levantamentos DJI verticais (nadir a 90°), gerar ortofotos, DSM e mosaicos privados, e devolver apenas referências de resultados aprovados.

| Princípio | Condição para activar no futuro |
|---|---|
| Isolamento | Worker em VM ou serviço de containers privado, separado da aplicação principal. |
| Recursos | Dimensionamento confirmado por voo de ensaio; pelo menos 16 GB RAM como ponto de partida para lotes fotogramétricos. |
| Segurança | Rede privada, autenticação serviço-a-serviço, sem exposição pública do worker nem das fotografias. |
| Dados | Fotografias e produtos guardados em armazenamento privado, com URLs temporárias e auditoria de acessos. |
| Qualidade | Aceitar apenas levantamentos com metadados DJI suficientes, geometria adequada e critérios de qualidade previamente validados. |
| Operação | Fila, limites de tamanho, observabilidade, cópias de segurança e procedimento de recuperação antes da activação. |

> Este documento é um registo de opção futura. Não representa uma funcionalidade disponível, configurada ou prometida na versão actual da Plataforma.
