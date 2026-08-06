CREATE TABLE `phase_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measureId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` enum('comment','photo','file') NOT NULL,
	`content` text,
	`fileKey` varchar(500),
	`filename` varchar(255),
	`mimeType` varchar(100),
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase_evidence_id` PRIMARY KEY(`id`)
);
