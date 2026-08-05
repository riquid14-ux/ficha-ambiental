CREATE TABLE `evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `workflowDescription` text;