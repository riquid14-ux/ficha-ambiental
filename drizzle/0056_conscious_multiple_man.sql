ALTER TABLE `measures` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `sections` ADD `projectId` int;--> statement-breakpoint
CREATE INDEX `measures_project_section_order_idx` ON `measures` (`projectId`,`sectionId`,`orderIndex`);--> statement-breakpoint
CREATE INDEX `sections_project_order_idx` ON `sections` (`projectId`,`orderIndex`);--> statement-breakpoint
-- O catálogo histórico passa a ser o catálogo-base de SIN02. Não se apaga informação.
UPDATE `sections` SET `projectId` = 1 WHERE `projectId` IS NULL;--> statement-breakpoint
UPDATE `measures` SET `projectId` = 1 WHERE `projectId` IS NULL;--> statement-breakpoint
-- Todos os projetos de construção recebem uma cópia independente das secções do catálogo-base.
INSERT INTO `sections` (`projectId`, `name`, `orderIndex`, `phase`)
SELECT p.`id`, s.`name`, s.`orderIndex`, s.`phase`
FROM `projects` p
CROSS JOIN `sections` s
WHERE s.`projectId` = 1
  AND p.`id` NOT IN (1, 60001);--> statement-breakpoint
-- As medidas são clonadas para a secção equivalente de cada projeto de construção.
INSERT INTO `measures` (`projectId`, `number`, `description`, `responsible`, `sectionId`, `orderIndex`)
SELECT p.`id`, m.`number`, m.`description`, m.`responsible`, targetSection.`id`, m.`orderIndex`
FROM `measures` m
JOIN `sections` sourceSection ON sourceSection.`id` = m.`sectionId` AND sourceSection.`projectId` = 1
JOIN `projects` p ON p.`id` NOT IN (1, 60001)
JOIN `sections` targetSection ON targetSection.`projectId` = p.`id`
  AND targetSection.`name` = sourceSection.`name`
  AND targetSection.`orderIndex` = sourceSection.`orderIndex`
  AND targetSection.`phase` = sourceSection.`phase`
WHERE m.`projectId` = 1;--> statement-breakpoint
-- O NEST/SIN01 conserva apenas as medidas aplicáveis à Exploração e à Desativação.
INSERT INTO `sections` (`projectId`, `name`, `orderIndex`, `phase`)
SELECT 60001, s.`name`, s.`orderIndex`, CASE WHEN s.`phase` = 'Desativação' THEN 'Desativação (Pós-Exploração)' ELSE s.`phase` END
FROM `sections` s
WHERE s.`projectId` = 1
  AND s.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');--> statement-breakpoint
INSERT INTO `measures` (`projectId`, `number`, `description`, `responsible`, `sectionId`, `orderIndex`)
SELECT 60001, m.`number`, m.`description`, m.`responsible`, targetSection.`id`, m.`orderIndex`
FROM `measures` m
JOIN `sections` sourceSection ON sourceSection.`id` = m.`sectionId` AND sourceSection.`projectId` = 1
JOIN `sections` targetSection ON targetSection.`projectId` = 60001
  AND targetSection.`name` = sourceSection.`name`
  AND targetSection.`orderIndex` = sourceSection.`orderIndex`
  AND targetSection.`phase` = CASE WHEN sourceSection.`phase` = 'Desativação' THEN 'Desativação (Pós-Exploração)' ELSE sourceSection.`phase` END
WHERE m.`projectId` = 1
  AND sourceSection.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');--> statement-breakpoint
-- Dados operacionais SIN01 já existentes passam para os identificadores isolados equivalentes.
UPDATE `phase_measure_statuses` ps
JOIN `measures` oldMeasure ON oldMeasure.`id` = ps.`measureId`
JOIN `sections` oldSection ON oldSection.`id` = oldMeasure.`sectionId`
JOIN `measures` newMeasure ON newMeasure.`projectId` = 60001 AND newMeasure.`number` = oldMeasure.`number`
JOIN `sections` newSection ON newSection.`id` = newMeasure.`sectionId` AND newSection.`phase` = oldSection.`phase`
SET ps.`measureId` = newMeasure.`id`
WHERE ps.`projectId` = 60001
  AND oldSection.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');--> statement-breakpoint
UPDATE `phase_measure_updates` pu
JOIN `measures` oldMeasure ON oldMeasure.`id` = pu.`measureId`
JOIN `sections` oldSection ON oldSection.`id` = oldMeasure.`sectionId`
JOIN `measures` newMeasure ON newMeasure.`projectId` = 60001 AND newMeasure.`number` = oldMeasure.`number`
JOIN `sections` newSection ON newSection.`id` = newMeasure.`sectionId` AND newSection.`phase` = oldSection.`phase`
SET pu.`measureId` = newMeasure.`id`
WHERE pu.`projectId` = 60001
  AND oldSection.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');--> statement-breakpoint
UPDATE `phase_evidence` pe
JOIN `measures` oldMeasure ON oldMeasure.`id` = pe.`measureId`
JOIN `sections` oldSection ON oldSection.`id` = oldMeasure.`sectionId`
JOIN `measures` newMeasure ON newMeasure.`projectId` = 60001 AND newMeasure.`number` = oldMeasure.`number`
JOIN `sections` newSection ON newSection.`id` = newMeasure.`sectionId` AND newSection.`phase` = oldSection.`phase`
SET pe.`measureId` = newMeasure.`id`
WHERE pe.`projectId` = 60001
  AND oldSection.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');--> statement-breakpoint
UPDATE `measure_responses` mr
JOIN `weekly_submissions` ws ON ws.`id` = mr.`submissionId`
JOIN `measures` oldMeasure ON oldMeasure.`id` = mr.`measureId`
JOIN `sections` oldSection ON oldSection.`id` = oldMeasure.`sectionId`
JOIN `measures` newMeasure ON newMeasure.`projectId` = 60001 AND newMeasure.`number` = oldMeasure.`number`
JOIN `sections` newSection ON newSection.`id` = newMeasure.`sectionId` AND newSection.`phase` = oldSection.`phase`
SET mr.`measureId` = newMeasure.`id`
WHERE ws.`projectId` = 60001
  AND oldSection.`phase` IN ('Exploração', 'Desativação', 'Desativação (Pós-Exploração)');
