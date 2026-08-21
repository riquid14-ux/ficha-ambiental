# Plataforma de Gestão Ambiental — Apresentação

## Slide 1: Capa
- Título: "Plataforma de Gestão Ambiental"
- Subtítulo: "Start Campus — Delivering Sustainable AI-Scale Data Centers"
- Data: Agosto 2026
- Fundo verde escuro corporativo Start Campus com gradiente

## Slide 2: Contexto e Desafio
- Título: "8 projectos em simultâneo exigem controlo ambiental rigoroso"
- SIN01 a SIN07 + Subestação 400kV em Sines
- 156 medidas ambientais DCAPE a monitorizar semanalmente
- Múltiplas entidades executantes (EE), RAP e RAA
- Processo actual: Excel dispersos, emails, Word manual
- Risco: incumprimento regulatório, perda de rastreabilidade

## Slide 3: A Solução
- Título: "Uma plataforma centralizada para toda a compliance ambiental"
- Plataforma web acessível de qualquer dispositivo
- Digitaliza todo o ciclo de vida das fichas de controlo
- Integra fichas semanais, resíduos, KPIs, certificações e relatórios
- 7 roles com permissões granulares por projecto
- Dados seguros com 2FA obrigatório e audit trail

## Slide 4: Página de Boas-Vindas
- Título: "Experiência personalizada para cada utilizador"
- Screenshot da página Welcome com cards de funcionalidades
- Cada role vê apenas as funcionalidades relevantes
- Vídeo institucional da Start Campus integrado
- Guia de utilização com workflow visual

## Slide 5: Fichas de Controlo Semanais
- Título: "156 medidas DCAPE preenchidas digitalmente todas as semanas"
- 6 abas: Nova Ficha, Estado de Fichas, Matriz, Histórico, Revisão, Importar
- EE/RAP preenchem com fotos e comentários por medida
- Estado: Cumprimento (C), Incumprimento (I), Não Aplicável (NA)
- Upload de evidências fotográficas por medida
- Importação de fichas históricas em PDF com extracção automática

## Slide 6: Workflow de Aprovação
- Título: "Workflow transparente com separação de deveres"
- EE/RAP cria e submete a ficha semanal
- RAA revê e aprova ou rejeita com comentários
- Notificações automáticas por email em cada etapa
- Quem submete não pode aprovar (compliance)
- Estado de Fichas: Rejeitadas (vermelho), Rascunhos (neutro), Aprovadas (verde)

## Slide 7: Dashboard de Cumprimento
- Título: "Visão em tempo real do cumprimento ambiental de todos os projectos"
- Screenshot do Dashboard com KPIs, gráficos e fases
- Cumprimento por projecto com barras de progresso
- Entregáveis e prazos com contagem regressiva
- Evolução semanal e acumulada
- Distribuição por entidade executante e por estado
- Filtro por ano para performance com grandes volumes de dados

## Slide 8: Matriz de Acompanhamento
- Título: "Saber exactamente quem entregou e quem falta"
- Screenshot da Matriz com empresas e semanas
- Cada célula mostra o estado da ficha (verde=entregue, vermelho=rejeitada, cinzento=sem ficha)
- Legenda visual com 6 estados
- Filtro por ano e por empresa
- Períodos activos por empresa (início/fim de trabalhos)

## Slide 9: RDCD — Relatório de Cumprimento
- Título: "Gerar o relatório semestral para a APA em minutos, não em dias"
- Screenshot do RDCD wizard com 4 passos
- Wizard: Projectos → Período → Medidas → Pré-visualização
- Exportação Word com fotos embebidas no anexo
- Selecção de medidas e evidências por secção
- Antes: 2-3 dias de trabalho manual. Agora: menos de 10 minutos

## Slide 10: KPIs Ambientais
- Título: "Metas ambientais acompanhadas com dados reais"
- Screenshot da página KPI
- 16 indicadores com metas anuais
- Gráficos de evolução por categoria
- Exportação Excel formatada com auto-filtro
- Filtro por ano para análise multi-anual

## Slide 11: Gestão de Resíduos
- Título: "eGARs, MIRR e Wastemap integrados numa só plataforma"
- Registo de guias eGAR com código LER
- MIRR — Mapa Integrado de Registo de Resíduos (exportação Excel)
- Wastemap visual com distribuição por tipo de resíduo
- Taxa de desvio de aterro por mês
- Tracking por operador e destino

## Slide 12: Mais Funcionalidades
- Título: "Ecossistema completo de gestão ambiental"
- Certificações: LEED O&M, EED, CELE com checklists por crédito
- GAMMA: Programa comunitário com candidaturas e avaliações
- Timeline: Fases de projecto (Pré-licenciamento → Operação)
- Calendário: Prazos regulatórios com alertas visuais
- Planos de Monitorização: Entregáveis com confirmação de entrega

## Slide 13: Administração e Gestão de Utilizadores
- Título: "Controlo total para administradores"
- Gestão de utilizadores com pesquisa, filtros e paginação (centenas de users)
- Convites por email com aprovação obrigatória
- Empresas com períodos activos (início/fim de trabalhos + buffer)
- Semanas sem trabalhos (Natal, paragens)
- Notificações configuráveis por projecto (zero spam)
- Audit trail de todas as operações críticas
- Configuração SMTP na interface

## Slide 14: Segurança de Nível Enterprise
- Título: "259 testes automatizados garantem segurança de nível enterprise"
- 2FA obrigatório (Google/Microsoft Authenticator)
- Rate limiting (10 tentativas/15min)
- Sanitização de ficheiros (PDFs, Word, SVGs)
- Helmet (headers HTTP), bcrypt, JWT com jose
- Testes OWASP Top 10 + Red Team Elite
- Separação de deveres e prevenção de enumeração de contas
- Audit log de operações críticas

## Slide 15: Impacto na Equipa
- Título: "Libertar pessoas para tarefas de maior valor, não substituir"
- Tabela de tempo poupado por função:
  - Técnico EE/RAP: de 3-4h para 30-45min (poupança 75%)
  - RAA: de 4-6h para 1-2h (poupança 65%)
  - Coordenador: de 6-8h para 1h (poupança 85%)
  - Admin/DO: de 2-3h para 15min (poupança 90%)
- Mais tempo no terreno, análise proactiva, preparação para auditorias

## Slide 16: Arquitectura e Integrações
- Título: "Pronta para integrar com o ecossistema Start Campus"
- Stack: React 19 + Node.js 22 + MySQL + tRPC
- Arquivo automático para SharePoint (dados ficam na BD + cópia externa)
- Azure OpenAI para importação inteligente de PDFs
- Preparada para ACC (Autodesk Construction Cloud)
- Custos operacionais: €10-125/mês

## Slide 17: Próximos Passos
- Título: "Roadmap de implementação"
- Semana 1-2: IT clona repositório, instala servidor, configura BD e SMTP
- Semana 2: Criar contas de utilizadores e empresas
- Semana 3: Formação das equipas (EE, RAP, RAA)
- Semana 3-4: Período piloto com 1-2 projectos
- Semana 5: Rollout para todos os projectos
- Mês 2: Integração SharePoint
- Mês 3: Integração ACC

## Slide 18: Encerramento
- Título: "Plataforma de Gestão Ambiental"
- Subtítulo: "Compliance ambiental digital, segura e rastreável"
- "Cada dado que aqui registamos contribui para um futuro mais sustentável."
- Contacto: apoioamb@startcampus.pt
- Start Campus — Sines, Portugal
