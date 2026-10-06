CREATE TABLE `operation_bms_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`eventId` varchar(120) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`batchId` int,
	`receivedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_bms_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `operation_bms_events_project_event_unique` UNIQUE(`projectId`,`eventId`)
);
--> statement-breakpoint
CREATE INDEX `operation_bms_events_batch_idx` ON `operation_bms_events` (`batchId`);