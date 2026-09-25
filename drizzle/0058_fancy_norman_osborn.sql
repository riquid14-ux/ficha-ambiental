CREATE TABLE `operation_chemical_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`chemicalName` varchar(255) NOT NULL,
	`quantity` varchar(80) NOT NULL,
	`unit` varchar(40) NOT NULL,
	`safetyThreshold` varchar(80),
	`location` varchar(255),
	`notes` text,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_chemical_inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_sustainability_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`recordedAt` varchar(10) NOT NULL,
	`hvoLiters` varchar(80),
	`dieselLiters` varchar(80),
	`absoluteCo2Tonnes` varchar(80),
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_sustainability_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operation_chemical_inventory_project_name_idx` ON `operation_chemical_inventory` (`projectId`,`chemicalName`);--> statement-breakpoint
CREATE INDEX `operation_sustainability_snapshot_project_recorded_idx` ON `operation_sustainability_snapshots` (`projectId`,`recordedAt`);