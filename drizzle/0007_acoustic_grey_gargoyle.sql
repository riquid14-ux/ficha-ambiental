CREATE TABLE `deletion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`companyId` int,
	`companyName` varchar(255),
	`deletedBy` int NOT NULL,
	`deletedByName` varchar(255),
	`deletedByEmail` varchar(255),
	`reason` text,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deletion_logs_id` PRIMARY KEY(`id`)
);
