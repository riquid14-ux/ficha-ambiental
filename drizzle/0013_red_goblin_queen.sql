CREATE TABLE `monitoring_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`name` varchar(500) NOT NULL,
	`category` enum('programa_monitorizacao','plano_projeto') NOT NULL DEFAULT 'programa_monitorizacao',
	`periodicity` varchar(100),
	`phase` varchar(100) NOT NULL DEFAULT 'construcao',
	`lastReportingDate` bigint,
	`nextReportingDate` bigint,
	`notes` text,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_phases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`phaseKey` varchar(100) NOT NULL,
	`phaseName` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_phases_id` PRIMARY KEY(`id`)
);
