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

Após uma falha visual comunicada no domínio publicado, a entrega do ativo foi confirmada diretamente pelo navegador e pelo servidor como imagem WebP válida. O componente passou a efetuar uma nova tentativa com URL sem cache quando a primeira carga falhar; se a fotografia continuar indisponível, bloqueia explicitamente o ajuste para impedir uma gravação sem referência visual.

## Entrega interna da fotografia em produção

Foi substituído o redirecionamento direto do armazenamento por uma rota interna protegida, `GET /api/operacao/media/nest-drone`, que valida a sessão e o âmbito de Operação do SIN01 antes de transmitir a imagem WebP. Depois de a implementação publicada terminar, a rota foi confirmada no domínio de produção com o identificador real do projeto (`60001`) e a página de Operação passou a referenciar essa rota no próprio dashboard.

## Proporção e simbologia dos marcadores

A superfície interativa foi limitada ao rácio visual `3:1`, igual ao enquadramento de decisão utilizado no cockpit. Desta forma, a imagem, os marcadores posicionados em percentagem e os vértices da área futura partilham a mesma superfície de referência e redimensionam-se de forma proporcional quando a janela muda de largura.

Foi configurada a simbologia de leitura inicial: água nos pontos 01, 02, 03, 08 e 14; operação humana nos pontos 06 e 09; energia no ponto 04; arrefecimento nos pontos 05, 07 e 11; e salas de servidores nos pontos 10, 12 e 13. A atualização preservou as coordenadas, os conteúdos técnicos, os gráficos Excel e as ligações financeiras existentes, e ficou registada no trilho de auditoria.

## Reposição controlada da área de edifícios futuros

Em 14-09-2026, a geometria violeta persistida foi reposta à referência padrão do cockpit depois de uma alteração visual indevida. Esta reposição anulou somente o polígono de planeamento; os catorze marcadores, ícones, posições, conteúdos técnicos e associações mantiveram-se inalterados. O cockpit SIN01 voltou a apresentar a orientação superior numa única linha e sem o modo temporário de arrasto exposto.
