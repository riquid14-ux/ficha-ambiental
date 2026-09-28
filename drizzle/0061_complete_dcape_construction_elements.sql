-- Completa os elementos 24 e 25 da DCAPE (AIA/RECAPE 3633, 11-11-2024).
-- Estes são elementos documentais da fase de construção, distintos das 111 medidas de minimização.

INSERT INTO sections (projectId, name, orderIndex, phase)
SELECT p.id, 'Elementos a apresentar durante a fase de construção', 350, 'Fase de construção'
FROM projects p
WHERE p.code = 'SIN02'
  AND NOT EXISTS (
    SELECT 1
    FROM sections s
    WHERE s.projectId = p.id
      AND s.name = 'Elementos a apresentar durante a fase de construção'
  );

INSERT INTO measures (projectId, number, description, responsible, sectionId, orderIndex)
SELECT p.id,
       'CC-24',
       'Relatório de Acompanhamento da Obra com periodicidade trimestral, fundamentalmente apoiado em registo fotográfico. Devem ser definidos pontos ou locais de referência para recolha comparável de imagens antes, durante e no final da obra, com elevada resolução.',
       'Start Campus',
       s.id,
       24
FROM projects p
JOIN sections s ON s.projectId = p.id
WHERE p.code = 'SIN02'
  AND s.name = 'Elementos a apresentar durante a fase de construção'
  AND NOT EXISTS (
    SELECT 1 FROM measures m WHERE m.projectId = p.id AND m.number = 'CC-24'
  );

INSERT INTO measures (projectId, number, description, responsible, sectionId, orderIndex)
SELECT p.id,
       'CC-25',
       'Atualização dos volumes de terras escavadas, acompanhada de soluções concretas para reutilização das terras sobrantes não contaminadas, com indicação dos volumes e dos locais de destino.',
       'Start Campus',
       s.id,
       25
FROM projects p
JOIN sections s ON s.projectId = p.id
WHERE p.code = 'SIN02'
  AND s.name = 'Elementos a apresentar durante a fase de construção'
  AND NOT EXISTS (
    SELECT 1 FROM measures m WHERE m.projectId = p.id AND m.number = 'CC-25'
  );
