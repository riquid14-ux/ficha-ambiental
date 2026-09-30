CREATE TABLE `rdcd_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`reportNumber` varchar(160),
	`reportYear` int NOT NULL,
	`startWeek` int NOT NULL,
	`endWeek` int NOT NULL,
	`reportPhase` varchar(160) NOT NULL,
	`revision` varchar(40) NOT NULL DEFAULT 'draft',
	`brandProfile` varchar(80) NOT NULL DEFAULT 'startcampus_gleeds_quadrante',
	`preparedBy` varchar(500),
	`reviewedBy` varchar(500),
	`contentJson` text NOT NULL,
	`selectionJson` text NOT NULL,
	`planIdsJson` text NOT NULL,
	`includePlans` boolean NOT NULL DEFAULT true,
	`includeWaste` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rdcd_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `rdcd_reports_project_period_idx` ON `rdcd_reports` (`projectId`,`reportYear`,`startWeek`,`endWeek`);--> statement-breakpoint
CREATE INDEX `rdcd_reports_updated_idx` ON `rdcd_reports` (`updatedAt`);