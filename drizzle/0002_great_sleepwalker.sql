CREATE TABLE `historical_pdfs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255),
	`uploadedBy` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historical_pdfs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`measureId` int,
	`userId` int NOT NULL,
	`comment` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','ee','raa','rap','dono_obra') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `weekly_submissions` MODIFY COLUMN `status` enum('draft','submitted','under_review','approved','rejected') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `companies` ADD `companyType` enum('ee','rap') DEFAULT 'ee' NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `reviewedAt` bigint;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `reviewNotes` text;