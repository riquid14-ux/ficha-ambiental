CREATE TABLE `apa_reporting_cycle_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`planId` int NOT NULL,
	`addedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apa_reporting_cycle_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `apa_reporting_cycle_plan_uq` UNIQUE(`cycleId`,`planId`)
);
--> statement-breakpoint
CREATE TABLE `apa_reporting_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`calendarEventId` int NOT NULL,
	`occurrenceAt` bigint NOT NULL,
	`projectId` int,
	`reportType` enum('rdcd','relatorio_anual_dcape','outro') NOT NULL DEFAULT 'rdcd',
	`receivedAt` bigint,
	`submissionDueAt` bigint,
	`submittedAt` bigint,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apa_reporting_cycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `apa_reporting_cycle_occurrence_uq` UNIQUE(`calendarEventId`,`occurrenceAt`)
);
--> statement-breakpoint
CREATE INDEX `apa_reporting_cycle_plan_idx` ON `apa_reporting_cycle_plans` (`planId`);--> statement-breakpoint
CREATE INDEX `apa_reporting_cycle_due_idx` ON `apa_reporting_cycles` (`submissionDueAt`);