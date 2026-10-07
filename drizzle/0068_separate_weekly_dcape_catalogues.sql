-- Separa definitivamente os dois controlos ambientais que antes coexistiam
-- no mesmo catálogo técnico:
--   weekly = Ficha Semanal Word (156 linhas, EE/RAA/DO/RAP, por empresa);
--   dcape  = Timeline/Fases (obrigações regulatórias por projeto).
-- Não elimina fichas, respostas, evidências nem histórico de revisões.

DROP INDEX `measures_project_section_order_idx` ON `measures`;--> statement-breakpoint
DROP INDEX `sections_project_order_idx` ON `sections`;--> statement-breakpoint
ALTER TABLE `measures` ADD `catalogueScope` enum('weekly','dcape') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE `sections` ADD `catalogueScope` enum('weekly','dcape') DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
CREATE INDEX `measures_project_scope_section_order_idx` ON `measures` (`projectId`,`catalogueScope`,`sectionId`,`orderIndex`);--> statement-breakpoint
CREATE INDEX `sections_project_scope_order_idx` ON `sections` (`projectId`,`catalogueScope`,`orderIndex`);--> statement-breakpoint

-- Os elementos documentais existentes pertencem apenas ao acompanhamento DCAPE.
UPDATE `measures`
SET `catalogueScope` = 'dcape'
WHERE `number` REGEXP '^(PL|SL|PC|CC|FC|DA|EX)-[0-9]+$';--> statement-breakpoint

UPDATE `sections` s
JOIN `measures` m ON m.`sectionId` = s.`id` AND m.`catalogueScope` = 'dcape'
SET s.`catalogueScope` = 'dcape';--> statement-breakpoint

-- Cria a estrutura regulatória por fase para projetos de construção. A ficha
-- semanal original mantém-se íntegra e no âmbito weekly.
INSERT INTO `sections` (`projectId`, `catalogueScope`, `name`, `orderIndex`, `phase`)
SELECT p.`id`, 'dcape', phaseTemplate.`name`, phaseTemplate.`orderIndex`, phaseTemplate.`phase`
FROM `projects` p
JOIN (
  SELECT 'DCAPE — Pré-licenciamento' AS `name`, 101 AS `orderIndex`, 'Previamente ao licenciamento' AS `phase`
  UNION ALL SELECT 'DCAPE — Licenciamento', 102, 'Em sede de licenciamento'
  UNION ALL SELECT 'DCAPE — Pré-construção', 103, 'Previamente ao início da fase de construção'
  UNION ALL SELECT 'DCAPE — Construção', 104, 'Fase de construção'
  UNION ALL SELECT 'DCAPE — Fase final da construção', 105, 'Fase final da construção'
  UNION ALL SELECT 'DCAPE — Exploração', 106, 'Fase de exploração'
  UNION ALL SELECT 'DCAPE — Desativação', 107, 'Fase de desativação'
) phaseTemplate
WHERE p.`code` NOT IN ('SIN01', 'ACP')
  AND NOT EXISTS (
    SELECT 1 FROM `sections` existing
    WHERE existing.`projectId` = p.`id`
      AND existing.`catalogueScope` = 'dcape'
      AND existing.`name` COLLATE utf8mb4_unicode_ci = phaseTemplate.`name` COLLATE utf8mb4_unicode_ci
  );--> statement-breakpoint

-- Uma obrigação DCAPE é acompanhada pelo número principal. As linhas 11.1,
-- 40.1, etc., permanecem apenas no Word semanal, onde são campos próprios.
INSERT INTO `measures` (`projectId`, `catalogueScope`, `number`, `description`, `responsible`, `sectionId`, `orderIndex`)
SELECT source.`projectId`, 'dcape', source.`number`, source.`description`, source.`responsible`, targetSection.`id`, source.`orderIndex`
FROM `measures` source
JOIN `projects` p ON p.`id` = source.`projectId`
JOIN `sections` targetSection
  ON targetSection.`projectId` = source.`projectId`
  AND targetSection.`catalogueScope` = 'dcape'
  AND targetSection.`name` COLLATE utf8mb4_unicode_ci = CONCAT('DCAPE — ', CASE
    WHEN CAST(source.`number` AS UNSIGNED) BETWEEN 1 AND 16 THEN 'Pré-construção'
    WHEN CAST(source.`number` AS UNSIGNED) BETWEEN 17 AND 86 THEN 'Construção'
    WHEN CAST(source.`number` AS UNSIGNED) BETWEEN 87 AND 91 THEN 'Fase final da construção'
    WHEN CAST(source.`number` AS UNSIGNED) BETWEEN 92 AND 110 THEN 'Exploração'
    ELSE 'Desativação'
  END) COLLATE utf8mb4_unicode_ci
WHERE source.`catalogueScope` = 'weekly'
  AND source.`number` REGEXP '^[0-9]+$'
  AND CAST(source.`number` AS UNSIGNED) BETWEEN 1 AND 111
  AND p.`code` NOT IN ('SIN01', 'ACP')
  AND NOT EXISTS (
    SELECT 1 FROM `measures` existing
    WHERE existing.`projectId` = source.`projectId`
      AND existing.`catalogueScope` = 'dcape'
      AND existing.`number` = source.`number`
  );--> statement-breakpoint

-- SIN01 não utiliza ficha de obra: as suas OPS EX-1…EX-19 e DA-1 são DCAPE.
UPDATE `sections` s
JOIN `projects` p ON p.`id` = s.`projectId` AND p.`code` = 'SIN01'
SET s.`catalogueScope` = 'dcape';--> statement-breakpoint

-- Remove exclusivamente o registo UAT identificado que, numa versão de teste,
-- tinha sido associado a PC-1 (uma obrigação DCAPE, não uma linha semanal).
-- Não elimina quaisquer respostas operacionais ou histórico de utilizadores.
DELETE FROM `measure_responses`
WHERE `observations` LIKE 'TESTE UAT (Claude/Rita)%';--> statement-breakpoint

-- Remove exclusivamente estados automáticos indevidos, gerados pela aprovação
-- de uma ficha semanal. A aprovação da RAA continua auditada em weekly_submissions.
DELETE FROM `phase_measure_statuses`
WHERE `notes` LIKE 'Aprovado via ficha #%';--> statement-breakpoint

-- Migra somente acompanhamento manual já existente para as cópias DCAPE do
-- número principal. Não se elimina o registo de origem se não houver destino.
UPDATE `phase_measure_statuses` statusRow
JOIN `measures` source
  ON source.`id` = statusRow.`measureId`
  AND source.`catalogueScope` = 'weekly'
  AND source.`number` REGEXP '^[0-9]+$'
JOIN `measures` target
  ON target.`projectId` = statusRow.`projectId`
  AND target.`catalogueScope` = 'dcape'
  AND target.`number` = source.`number`
SET statusRow.`measureId` = target.`id`;--> statement-breakpoint

UPDATE `phase_measure_updates` updateRow
JOIN `measures` source
  ON source.`id` = updateRow.`measureId`
  AND source.`catalogueScope` = 'weekly'
  AND source.`number` REGEXP '^[0-9]+$'
JOIN `measures` target
  ON target.`projectId` = updateRow.`projectId`
  AND target.`catalogueScope` = 'dcape'
  AND target.`number` = source.`number`
SET updateRow.`measureId` = target.`id`;--> statement-breakpoint

UPDATE `phase_evidence` evidenceRow
JOIN `measures` source
  ON source.`id` = evidenceRow.`measureId`
  AND source.`catalogueScope` = 'weekly'
  AND source.`number` REGEXP '^[0-9]+$'
JOIN `measures` target
  ON target.`projectId` = evidenceRow.`projectId`
  AND target.`catalogueScope` = 'dcape'
  AND target.`number` = source.`number`
SET evidenceRow.`measureId` = target.`id`;
