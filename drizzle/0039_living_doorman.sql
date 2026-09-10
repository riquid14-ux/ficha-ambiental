CREATE TABLE `document_library_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`projectId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_library_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_library_project_unique` UNIQUE(`documentId`,`projectId`)
);
--> statement-breakpoint
ALTER TABLE `document_library` ADD `appliesToAllProjects` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `document_library_project_idx` ON `document_library_projects` (`projectId`,`documentId`);