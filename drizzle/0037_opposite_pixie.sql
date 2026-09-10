CREATE TABLE `document_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` enum('obrigacoes_ambientais','certificacoes','recomendacoes') NOT NULL,
	`subtopic` varchar(100),
	`title` varchar(255) NOT NULL,
	`language` varchar(50) NOT NULL,
	`description` text,
	`fileKey` varchar(500) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `document_library_status_topic_idx` ON `document_library` (`status`,`topic`);--> statement-breakpoint
CREATE INDEX `document_library_topic_subtopic_idx` ON `document_library` (`topic`,`subtopic`);--> statement-breakpoint
CREATE INDEX `document_library_created_idx` ON `document_library` (`createdAt`);