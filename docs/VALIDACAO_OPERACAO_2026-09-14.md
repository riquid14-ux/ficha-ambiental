# Validação de Operação — 14 de setembro de 2026

## Ajustes de infraestrutura NEST

Com sessão autenticada de Administrador no SIN01 — NEST, foi confirmado que o atalho **Definir infraestrutura** abre diretamente Administração > Operação > Infraestrutura. A ação confirmada **Aplicar marcadores amarelos** substituiu os seis pontos de referência anteriores por catorze marcadores amarelos configuráveis e uma área persistente de **Edifícios futuros**; a substituição ficou registada no trilho de auditoria.

O editor permite alterar, para cada marcador, título, subtítulo, sistema, estado, posição X/Y, ordem, métricas, tendência, documento, descrição e nota técnica. A alteração da representação visual não altera leituras medidas, telemetria ou fórmulas do cockpit.

No cockpit, foram confirmados os catorze marcadores amarelos persistidos e a camada **Edifícios futuros · planeamento**. O botão **Simular futuro** passou a selecionar imediatamente o separador **Previsões e cenários** e abrir o formulário de novo cenário, mantendo os cenários separados do histórico medido.

Por fim, a roldana **Fontes e cálculos** foi confirmada com ligação direta a Administração > Operação > Fontes e cálculos. A secção distingue relatórios operacionais/BMS, água medida, faturas e parâmetros aprovados, e torna explícitas as regras atuais de WUE, CUE, previsão e limites. As fórmulas apresentadas refletem a lógica implementada e não permitem que parâmetros administrativos substituam leituras medidas.

## Correção visual da fotografia

A referência anterior da fotografia foi republicada no armazenamento web do projeto e a nova URL devolve `image/webp`. O dashboard foi simplificado para uma única área visual: a lista lateral longa de pontos foi removida, permanecendo apenas os marcadores interativos sobre a fotografia e uma instrução curta de utilização.

Na sessão administrativa em SIN01 — NEST, a imagem foi apresentada corretamente com os catorze marcadores amarelos, a zona violeta de edifícios futuros e sem lista lateral. A interação mantém-se diretamente nos pontos sobre a fotografia.

## Alinhamento e cartões de dados

Foi aplicada, com confirmação administrativa, uma nova marcação persistente alinhada à referência visual fornecida: catorze pontos amarelos e um ponto separado para **Edifícios futuros · planeamento**. Os pontos substituídos permanecem apenas no trilho de auditoria; a leitura operacional passou a usar as novas coordenadas.

O editor passa a aceitar por ponto dados técnicos estruturados, tipos de fatura associados e um Excel `.xlsx` seguro como fonte de gráfico. A leitura do Excel limita a folha a uma coluna de rótulos e até três séries numéricas, e o cartão apresenta os dados sem alterar leituras, fatores, cálculos ou documentos financeiros de origem.

## Modo temporário de afinação no mapa

Para permitir a correção visual no próprio contexto da fotografia, foi disponibilizado ao Administrador o botão **Ajustar no mapa**. O modo apresenta cada marcador amarelo como elemento arrastável e seis vértices violeta para redesenhar a área de edifícios futuros. A gravação é única, auditada, limitada ao SIN01/NEST e mantém toda a informação de cada cartão; o cancelamento não persiste qualquer coordenada provisória.
