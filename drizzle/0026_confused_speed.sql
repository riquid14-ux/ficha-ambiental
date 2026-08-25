CREATE TABLE `phase_measure_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`measureId` int NOT NULL,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase_measure_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `ownerId` int;--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `ownerName` varchar(255);--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `supportName` varchar(255);--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `supportCompany` varchar(255);--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `supportEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `supportPhone` varchar(80);--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD `trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') DEFAULT 'nao_iniciado' NOT NULL;--> statement-breakpoint
ALTER TABLE `phase_measure_statuses` ADD CONSTRAINT `phase_measure_statuses_project_measure_uq` UNIQUE(`projectId`,`measureId`);--> statement-breakpoint
CREATE INDEX `phase_measure_updates_project_measure_created_idx` ON `phase_measure_updates` (`projectId`,`measureId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `phase_measure_updates_created_idx` ON `phase_measure_updates` (`createdAt`);--> statement-breakpoint
CREATE INDEX `phase_measure_statuses_owner_idx` ON `phase_measure_statuses` (`ownerId`);