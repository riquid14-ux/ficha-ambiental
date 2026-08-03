CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`companyId` int NOT NULL,
	`role` enum('user','admin','ee','raa','rap','dono_obra','observador') NOT NULL DEFAULT 'ee',
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `measure_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`measureId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`verdict` enum('ok','nok') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `measure_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` MODIFY COLUMN `companyType` enum('ee','rap','dono_obra','raa','observador') NOT NULL DEFAULT 'ee';--> statement-breakpoint
ALTER TABLE `companies` MODIFY COLUMN `updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `fullName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `jobTitle` varchar(255);