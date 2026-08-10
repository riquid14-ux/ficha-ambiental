CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`name` varchar(500) NOT NULL,
	`description` text,
	`periodicity` varchar(100),
	`firstDate` bigint NOT NULL,
	`nextDate` bigint,
	`lastDeliveredDate` bigint,
	`category` varchar(100),
	`active` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
