CREATE TABLE `eep_request_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eep_request_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `eep_request_users_request_email_unique` UNIQUE(`requestId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `eep_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestedByUserId` int NOT NULL,
	`parentCompanyId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`shortName` varchar(50) NOT NULL,
	`allowKpi` boolean NOT NULL DEFAULT false,
	`allowWaste` boolean NOT NULL DEFAULT false,
	`projectIdsJson` text NOT NULL,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`reviewNotes` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdCompanyId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eep_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `eep_request_users_request_idx` ON `eep_request_users` (`requestId`);--> statement-breakpoint
CREATE INDEX `eep_requests_parent_company_idx` ON `eep_requests` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `eep_requests_requester_idx` ON `eep_requests` (`requestedByUserId`);--> statement-breakpoint
CREATE INDEX `eep_requests_status_idx` ON `eep_requests` (`status`);