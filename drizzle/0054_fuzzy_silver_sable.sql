CREATE TABLE `operational_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','investigating','monitoring','resolved') NOT NULL DEFAULT 'open',
	`affectedServices` varchar(500) NOT NULL DEFAULT 'Aplicação',
	`impactSummary` text,
	`recoverySteps` text,
	`followUpActions` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operational_incidents_status_occurred_idx` ON `operational_incidents` (`status`,`occurredAt`);