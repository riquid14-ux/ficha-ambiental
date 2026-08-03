CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`shortName` varchar(50) NOT NULL,
	`logoUrl` text,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255),
	`mimeType` varchar(100),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measure_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`measureId` int NOT NULL,
	`status` enum('I','C','NC','NA'),
	`observations` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measure_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`description` text NOT NULL,
	`responsible` varchar(50) NOT NULL,
	`sectionId` int NOT NULL,
	`orderIndex` int NOT NULL,
	CONSTRAINT `measures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`orderIndex` int NOT NULL,
	`phase` varchar(100) NOT NULL,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`weekStartDate` varchar(10) NOT NULL,
	`weekEndDate` varchar(10) NOT NULL,
	`status` enum('draft','submitted') NOT NULL DEFAULT 'draft',
	`submittedBy` int,
	`submittedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `companyId` int;