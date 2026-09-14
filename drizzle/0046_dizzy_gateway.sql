CREATE TABLE `operation_infrastructure_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`subtitle` varchar(255),
	`systemType` varchar(80) NOT NULL DEFAULT 'infraestrutura',
	`status` varchar(40) NOT NULL DEFAULT 'operacional',
	`xPercent` int NOT NULL,
	`yPercent` int NOT NULL,
	`description` text,
	`metricCodesJson` text NOT NULL,
	`chartMetricCode` varchar(100),
	`documentTitle` varchar(255),
	`documentUrl` varchar(1000),
	`technicalNote` text,
	`isFuture` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_infrastructure_points_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operation_infrastructure_points_project_order_idx` ON `operation_infrastructure_points` (`projectId`,`sortOrder`);