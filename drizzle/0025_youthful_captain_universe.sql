CREATE TABLE `project_phase_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phaseId` int NOT NULL,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_phase_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_phases` ADD `ownerId` int;--> statement-breakpoint
ALTER TABLE `project_phases` ADD `ownerName` varchar(255);--> statement-breakpoint
ALTER TABLE `project_phases` ADD `supportName` varchar(255);--> statement-breakpoint
ALTER TABLE `project_phases` ADD `supportCompany` varchar(255);--> statement-breakpoint
ALTER TABLE `project_phases` ADD `supportEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `project_phases` ADD `supportPhone` varchar(80);--> statement-breakpoint
ALTER TABLE `project_phases` ADD `trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') DEFAULT 'nao_iniciado' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_phases` ADD CONSTRAINT `project_phases_project_key_uq` UNIQUE(`projectId`,`phaseKey`);--> statement-breakpoint
CREATE INDEX `project_phase_updates_phase_idx` ON `project_phase_updates` (`phaseId`);--> statement-breakpoint
CREATE INDEX `project_phase_updates_created_idx` ON `project_phase_updates` (`createdAt`);--> statement-breakpoint
CREATE INDEX `project_phases_owner_idx` ON `project_phases` (`ownerId`);--> statement-breakpoint
INSERT INTO `project_phases` (`projectId`,`phaseKey`,`phaseName`,`active`,`orderIndex`,`hidden`,`progress`)
SELECT p.id, 'Exploração', 'Fase de Exploração', 1, 8, 0, 0
FROM `projects` p
WHERE p.code = 'SIN01'
  AND NOT EXISTS (
    SELECT 1 FROM `project_phases` pp
    WHERE pp.projectId = p.id AND pp.phaseKey = 'Exploração'
  );--> statement-breakpoint
INSERT INTO `project_phases` (`projectId`,`phaseKey`,`phaseName`,`active`,`orderIndex`,`hidden`,`progress`)
SELECT p.id, 'Desativação (Pós-Exploração)', 'Fase de Desativação', 1, 9, 0, 0
FROM `projects` p
WHERE p.code = 'SIN01'
  AND NOT EXISTS (
    SELECT 1 FROM `project_phases` pp
    WHERE pp.projectId = p.id AND pp.phaseKey = 'Desativação (Pós-Exploração)'
  );
