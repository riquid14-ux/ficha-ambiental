ALTER TABLE `monitoring_plan_attachments` MODIFY COLUMN `assignmentId` int;--> statement-breakpoint
ALTER TABLE `monitoring_plan_updates` MODIFY COLUMN `assignmentId` int;--> statement-breakpoint
ALTER TABLE `monitoring_plan_attachments` MODIFY COLUMN `assignmentId` int;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `sourceKey` varchar(255);--> statement-breakpoint
ALTER TABLE `monitoring_plan_attachments` ADD `planId` int;--> statement-breakpoint
ALTER TABLE `monitoring_plan_updates` ADD `planId` int;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `ownerId` int;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `ownerName` varchar(255);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `supportName` varchar(255);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `supportCompany` varchar(255);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `supportEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `supportPhone` varchar(80);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') DEFAULT 'nao_iniciado' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_source_key_uq` UNIQUE(`sourceKey`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_plan_idx` ON `monitoring_plan_attachments` (`planId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_updates_plan_created_idx` ON `monitoring_plan_updates` (`planId`,`createdAt`);--> statement-breakpoint
UPDATE `monitoring_plan_updates` updates
INNER JOIN `monitoring_plan_assignments` assignment ON assignment.`id` = updates.`assignmentId`
SET updates.`planId` = assignment.`planId`
WHERE updates.`planId` IS NULL;--> statement-breakpoint
UPDATE `monitoring_plan_attachments` attachments
INNER JOIN `monitoring_plan_assignments` assignment ON assignment.`id` = attachments.`assignmentId`
SET attachments.`planId` = assignment.`planId`
WHERE attachments.`planId` IS NULL;--> statement-breakpoint
UPDATE `monitoring_plans` plan
LEFT JOIN `monitoring_plan_assignments` assignment ON assignment.`id` = (
	SELECT candidate.`id`
	FROM `monitoring_plan_assignments` candidate
	WHERE candidate.`planId` = plan.`id`
	ORDER BY
		(candidate.`ownerId` IS NOT NULL) DESC,
		(candidate.`nextReportingDate` IS NOT NULL) DESC,
		candidate.`updatedAt` DESC,
		candidate.`id` DESC
	LIMIT 1
)
SET
	plan.`ownerId` = COALESCE(plan.`ownerId`, assignment.`ownerId`),
	plan.`ownerName` = COALESCE(plan.`ownerName`, assignment.`ownerName`),
	plan.`trackingStatus` = CASE
		WHEN plan.`trackingStatus` = 'nao_iniciado' AND assignment.`status` <> 'nao_iniciado' THEN assignment.`status`
		ELSE plan.`trackingStatus`
	END,
	plan.`lastReportingDate` = COALESCE(plan.`lastReportingDate`, assignment.`lastReportingDate`),
	plan.`nextReportingDate` = COALESCE(plan.`nextReportingDate`, assignment.`nextReportingDate`),
	plan.`submissionStatus` = CASE
		WHEN plan.`submissionStatus` = 'pending' AND assignment.`submissionStatus` <> 'pending' THEN assignment.`submissionStatus`
		ELSE plan.`submissionStatus`
	END,
	plan.`confirmedDeliveryAt` = COALESCE(plan.`confirmedDeliveryAt`, assignment.`confirmedDeliveryAt`)
WHERE assignment.`id` IS NOT NULL;--> statement-breakpoint
UPDATE `monitoring_plans`
SET `projectId` = NULL
WHERE `projectId` IS NOT NULL;--> statement-breakpoint
UPDATE `calendar_events`
SET `active` = 0
WHERE `sourceType` = 'monitoring_plan_assignment';--> statement-breakpoint
INSERT INTO `calendar_events`
	(`projectId`,`name`,`description`,`periodicity`,`firstDate`,`nextDate`,`category`,`status`,`ownerId`,`ownerName`,`sourceType`,`sourceId`,`sourceKey`,`active`)
SELECT
	NULL,
	CONCAT(plan.`planNumber`, ' — ', plan.`name`),
	'Prazo sincronizado automaticamente a partir do módulo Planos.',
	plan.`periodicity`,
	plan.`nextReportingDate`,
	plan.`nextReportingDate`,
	'monitoring_plan',
	IF(plan.`submissionStatus` = 'delivered', 'confirmed', 'pending'),
	plan.`ownerId`,
	plan.`ownerName`,
	'monitoring_plan',
	plan.`id`,
	CONCAT('monitoring_plan:', plan.`id`),
	plan.`active`
FROM `monitoring_plans` plan
WHERE plan.`nextReportingDate` IS NOT NULL
ON DUPLICATE KEY UPDATE
	`projectId` = NULL,
	`name` = VALUES(`name`),
	`description` = VALUES(`description`),
	`periodicity` = VALUES(`periodicity`),
	`firstDate` = VALUES(`firstDate`),
	`nextDate` = VALUES(`nextDate`),
	`category` = VALUES(`category`),
	`status` = VALUES(`status`),
	`ownerId` = VALUES(`ownerId`),
	`ownerName` = VALUES(`ownerName`),
	`sourceType` = VALUES(`sourceType`),
	`sourceId` = VALUES(`sourceId`),
	`active` = VALUES(`active`);
