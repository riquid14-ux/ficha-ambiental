CREATE TABLE `calendar_reminder_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`deadlineDate` bigint NOT NULL,
	`reminderDays` int NOT NULL,
	`recipientUserId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_reminder_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_reminder_logs_unique` UNIQUE(`eventId`,`deadlineDate`,`reminderDays`,`recipientEmail`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int,
	`ownerName` varchar(255),
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`lastReportingDate` bigint,
	`nextReportingDate` bigint,
	`submissionStatus` enum('pending','submitted','delivered') NOT NULL DEFAULT 'pending',
	`confirmedDeliveryAt` bigint,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_plan_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitoring_plan_assignments_plan_project_uq` UNIQUE(`planId`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`updateId` int,
	`type` enum('photo','file') NOT NULL DEFAULT 'file',
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(255) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_plan_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_plan_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `sourceType` varchar(50);
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `sourceId` int;
--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `planNumber` varchar(50);
--> statement-breakpoint
UPDATE `monitoring_plans`
SET `planNumber` = CONCAT('P-', LPAD(`id`, 2, '0'))
WHERE `planNumber` IS NULL OR `planNumber` = '';
--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD CONSTRAINT `monitoring_plans_plan_number_uq` UNIQUE(`planNumber`);
--> statement-breakpoint
INSERT INTO `monitoring_plan_assignments`
	(`planId`, `projectId`, `status`, `lastReportingDate`, `nextReportingDate`, `submissionStatus`, `confirmedDeliveryAt`, `active`)
SELECT
	mp.`id`, mp.`projectId`, 'nao_iniciado', mp.`lastReportingDate`, mp.`nextReportingDate`, mp.`submissionStatus`, mp.`confirmedDeliveryAt`, mp.`active`
FROM `monitoring_plans` mp
WHERE mp.`projectId` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `calendar_events`
	(`projectId`, `name`, `description`, `periodicity`, `firstDate`, `nextDate`, `category`, `status`, `ownerId`, `ownerName`, `active`, `sourceType`, `sourceId`)
SELECT
	assignment.`projectId`,
	CONCAT(COALESCE(plan.`planNumber`, CONCAT('P-', LPAD(plan.`id`, 2, '0'))), ' — ', plan.`name`),
	'Prazo sincronizado automaticamente a partir do módulo Planos.',
	plan.`periodicity`,
	assignment.`nextReportingDate`,
	assignment.`nextReportingDate`,
	'monitoring_plan',
	IF(assignment.`submissionStatus` = 'delivered', 'confirmed', 'pending'),
	assignment.`ownerId`,
	assignment.`ownerName`,
	1,
	'monitoring_plan_assignment',
	assignment.`id`
FROM `monitoring_plan_assignments` assignment
INNER JOIN `monitoring_plans` plan ON plan.`id` = assignment.`planId`
WHERE assignment.`nextReportingDate` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_source_project_uq` UNIQUE(`sourceType`,`sourceId`,`projectId`);
--> statement-breakpoint
CREATE INDEX `calendar_reminder_logs_event_idx` ON `calendar_reminder_logs` (`eventId`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_project_idx` ON `monitoring_plan_assignments` (`projectId`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_owner_idx` ON `monitoring_plan_assignments` (`ownerId`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_due_idx` ON `monitoring_plan_assignments` (`nextReportingDate`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_assignment_idx` ON `monitoring_plan_attachments` (`assignmentId`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_update_idx` ON `monitoring_plan_attachments` (`updateId`);
--> statement-breakpoint
CREATE INDEX `monitoring_plan_updates_assignment_created_idx` ON `monitoring_plan_updates` (`assignmentId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `calendar_events_owner_idx` ON `calendar_events` (`ownerId`);
--> statement-breakpoint
CREATE INDEX `calendar_events_next_date_idx` ON `calendar_events` (`nextDate`);
