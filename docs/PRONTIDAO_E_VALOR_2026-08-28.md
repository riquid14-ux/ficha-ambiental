# Prontidão e custo de substituição — Plataforma de Gestão Ambiental — Start Campus

Esta avaliação foi preparada em 28 de agosto de 2026. Trata-se de uma análise de **maturidade do produto** e de **custo de substituição** do software construído; não corresponde a uma avaliação de mercado, preço de venda garantido, receita futura ou valor contabilístico.

## Estado funcional

| Área | Estado verificado | Observação |
| --- | --- | --- |
| Fichas semanais e revisão | Pronto em aplicação | Workflow multi-entidade, rejeição parcial, histórico e segregação de funções já testados. |
| KPI, métricas e relatórios | Pronto em aplicação | Métricas administráveis; dashboards e exportação de relatório profissional por semana inicial/final e ano, validados com dados QA removidos. |
| e-GAR, subprojectos e MIRR | Pronto em aplicação | Registo estruturado, Waste Map, subprojectos e exportação. A submissão oficial continua sujeita à validação humana e às integrações externas. |
| Empresas, pessoas, convites e EEP | Pronto em aplicação | Gestão exclusiva por Admin, audit trail, convite/aceitação, EE→EEP, módulos e âmbito de projecto validados. |
| Mapa privado | Pronto para gestão de referência | Leitura Admin/DO/PM, escrita Admin, vista de referência Start Campus de 1 km, limites WGS84 individuais e vista Todos os Projectos. |
| Segurança e resiliência de aplicação | Validada em desenvolvimento | 426 testes passaram; auditoria de produção não reportou vulnerabilidades conhecidas; watchdog e recuperação foram testados de forma isolada. |

## Dependências que ainda exigem trabalho de implementação corporativa

| Dependência | Estado actual | Acção necessária antes de a declarar operacional em produção |
| --- | --- | --- |
| SharePoint / arquivo documental | Preparado para integração, não ligado a um tenant Start Campus | Configurar identidade de aplicação, permissões mínimas, biblioteca documental, retenção e testes de recuperação. |
| ACC | Preparado conceptualmente, sem ligação corporativa activa | Registar integração, configurar OAuth/credenciais, permissões por projecto e testar fluxos no ambiente ACC da Start Campus. |
| Email corporativo | Fluxos de notificação previstos; não testar com destinatários reais | Configurar fornecedor, domínio, SPF/DKIM/DMARC, listas de destinatários e regras anti-spam. |
| Template RDCD | Pendente de recepção do modelo final | Receber template, mapear capítulos/campos, gerar um relatório de aceitação e obter validação técnica. |
| Ortofoto / DSM / tiles DJI reais | Contrato preparado; processamento pesado deliberadamente desligado | Criar worker isolado com NodeODM, fila, armazenamento privado, recursos adequados e ensaio com voo nadir 90°. |
| Operação de recuperação | Scripts e testes existem; não foram instalados no servidor Start Campus | Configurar PM2/watchdog, backup restaurável, destinatários de incidentes, CI/CD e teste de recuperação no servidor final. |

## Pontuação de maturidade

| Dimensão | Pontuação | Base da pontuação |
| --- | ---: | --- |
| Fluxos ambientais e experiência de utilização | 8,8 / 10 | Cobertura ampla de fichas, KPI, resíduos, calendários, planos, fases, EEP e reporting. |
| Segurança de aplicação e segregação de funções | 8,5 / 10 | Autorização no backend, audit trail, testes OWASP/red team/roles, sanitização e auditoria de dependências limpa. |
| Reporting e rastreabilidade | 8,4 / 10 | Exportação por período, tabelas estruturadas, histórico e filtros; RDCD final depende ainda do template oficial. |
| Integração e operação corporativa | 6,8 / 10 | ACC, SharePoint, email corporativo e recuperação no servidor da Start Campus ainda requerem configuração e testes finais. |
| Fotogrametria DJI real | 5,0 / 10 | A gestão de mapa e a validação de capturas verticais estão prontas; o processamento NodeODM real ainda não foi instalado. |
| **Maturidade global actual** | **8,1 / 10** | Adequada para demonstração e piloto controlado. A classificação de produção corporativa depende das integrações e ensaios de operação listados acima. |

## Estimativa de custo de substituição

O cálculo pressupõe uma equipa externa que tenha de reconstruir o produto, validar os fluxos e entregar documentação técnica equivalente. O esforço considerado é de **5.600 a 8.550 horas**, incluindo análise funcional, desenho UX, frontend, backend, modelo de dados, regras de autorização, exportações, testes automatizados, QA, gestão de projecto e documentação. Não inclui o custo de executar NodeODM real, ligar ACC/SharePoint, configurar o servidor Start Campus nem suporte pós-produção.

| Cenário | Horas | Taxa média assumida | Contingência | Custo de substituição estimado |
| --- | ---: | ---: | ---: | ---: |
| Equipa especializada com custo controlado | 5.600 | €70/h | 10% | **€431.200** |
| Entrega completa por parceiro tecnológico | 8.550 | €95/h | 15% | **€934.088** |
| Implementação corporativa após as integrações pendentes | 6.500–9.000 | €85–€110/h | 15–20% | **€635.375–€1.188.000** |

Consequentemente, afirmar que o produto já representa **mais de €350.000 de custo de substituição** é defensável no cenário descrito, desde que se explique que se trata de software sob medida, com workflows específicos, testes e controlos de segurança. Não é correcto apresentar este intervalo como preço de venda garantido: para avaliar valor comercial seriam necessários dados de receita, número de clientes, retenção, margem, direitos de propriedade intelectual e transacções comparáveis.
