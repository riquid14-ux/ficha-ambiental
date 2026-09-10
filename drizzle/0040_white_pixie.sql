CREATE TABLE `kpi_submission_changes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`action` varchar(40) NOT NULL,
	`actorId` int NOT NULL,
	`actorName` varchar(255) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`changedValues` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_submission_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `kpi_submission_changes_submission_idx` ON `kpi_submission_changes` (`submissionId`,`createdAt`);