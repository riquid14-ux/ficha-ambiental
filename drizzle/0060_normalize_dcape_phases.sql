-- Normalização da timeline DCAPE (AIA/RECAPE 3633, 11-11-2024).
-- Preserva os registos e atualizações legados: apenas desativa linhas duplicadas
-- que antes representavam a mesma fase visual.

-- 1. Canonicalizar os registos de fase que já não têm equivalente concorrente.
UPDATE project_phases
SET phaseKey = 'pre_licenciamento', phaseName = 'Previamente ao licenciamento', orderIndex = 1
WHERE phaseKey = 'previas_licenciamento';

UPDATE project_phases
SET phaseKey = 'licenciamento', phaseName = 'Em sede de licenciamento', orderIndex = 2
WHERE phaseKey = 'sede_licenciamento';

UPDATE project_phases
SET phaseName = 'Previamente ao início da fase de construção', orderIndex = 3
WHERE phaseKey = 'pre_construcao';

UPDATE project_phases
SET phaseName = 'Fase de construção', orderIndex = 4
WHERE phaseKey = 'construcao';

UPDATE project_phases
SET phaseName = 'Fase final da construção', orderIndex = 5
WHERE phaseKey IN ('fase_final_construcao', 'final_construcao');

UPDATE project_phases
SET phaseKey = 'final_construcao', phaseName = 'Fase final da construção', orderIndex = 5
WHERE phaseKey = 'fase_final_construcao';

UPDATE project_phases
SET phaseName = 'Fase de exploração', orderIndex = 6
WHERE phaseKey = 'exploracao';

UPDATE project_phases
SET phaseName = 'Fase de desativação', orderIndex = 7
WHERE phaseKey = 'desativacao';

UPDATE project_phases AS legacy
LEFT JOIN project_phases AS canonical
  ON canonical.projectId = legacy.projectId AND BINARY canonical.phaseKey = BINARY 'desativacao'
SET legacy.phaseKey = 'desativacao', legacy.phaseName = 'Fase de desativação', legacy.orderIndex = 7
WHERE BINARY legacy.phaseKey = BINARY 'Desativação (Pós-Exploração)' AND canonical.id IS NULL;

-- 2. Os duplicados antigos ficam preservados mas inativos (não aparecem no produto).
UPDATE project_phases SET active = 0 WHERE phaseKey IN ('preparacao_previa', 'execucao_obra', 'fase_final');

-- 2b. Garantir o ciclo completo nos projetos de construção. SIN01 continua
-- exclusivamente com exploração e desativação, como definido para o NEST.
INSERT INTO project_phases (projectId, phaseKey, phaseName, active, orderIndex, hidden, progress, trackingStatus)
SELECT projects.id, cycle.phaseKey, cycle.phaseName, 1, cycle.orderIndex, 0, 0, 'nao_iniciado'
FROM projects
JOIN (
  SELECT 'pre_licenciamento' AS phaseKey, 'Previamente ao licenciamento' AS phaseName, 1 AS orderIndex
  UNION ALL SELECT 'licenciamento', 'Em sede de licenciamento', 2
  UNION ALL SELECT 'pre_construcao', 'Previamente ao início da fase de construção', 3
  UNION ALL SELECT 'construcao', 'Fase de construção', 4
  UNION ALL SELECT 'final_construcao', 'Fase final da construção', 5
  UNION ALL SELECT 'exploracao', 'Fase de exploração', 6
  UNION ALL SELECT 'desativacao', 'Fase de desativação', 7
) AS cycle
WHERE BINARY projects.code <> BINARY 'SIN01'
  AND NOT EXISTS (
    SELECT 1 FROM project_phases existing
    WHERE existing.projectId = projects.id AND BINARY existing.phaseKey = BINARY cycle.phaseKey
  );

-- 3. Canonicalizar as etiquetas de secção. A associação histórica à secção e às
-- medidas mantém-se integralmente; o agrupamento visual usa a chave DCAPE única.
UPDATE sections SET phase = 'Previamente ao licenciamento'
WHERE phase IN ('Prévias Licenciamento', 'Previamente ao Licenciamento');
UPDATE sections SET phase = 'Em sede de licenciamento'
WHERE phase IN ('Em Sede de Licenciamento', 'Em sede de licenciamento');
UPDATE sections SET phase = 'Previamente ao início da fase de construção'
WHERE phase IN ('Pré-Construção', 'Preparação Prévia', 'Preparação Prévia à Construção');
UPDATE sections SET phase = 'Fase de construção'
WHERE phase IN ('Execução da Obra', 'Construção');
UPDATE sections SET phase = 'Fase final da construção'
WHERE phase IN ('Fase Final', 'Fase Final Construção', 'Fase Final da Construção');
UPDATE sections SET phase = 'Fase de exploração'
WHERE phase IN ('Exploração', 'Operação');
UPDATE sections SET phase = 'Fase de desativação'
WHERE phase IN ('Desativação', 'Desativação (Pós-Exploração)');
