CREATE TABLE `partner_company_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`parentCompanyId` int NOT NULL,
	`allowKpi` boolean NOT NULL DEFAULT false,
	`allowWaste` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`configuredBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_company_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_company_profiles_company_unique` UNIQUE(`companyId`)
);
--> statement-breakpoint
CREATE INDEX `partner_company_profiles_parent_idx` ON `partner_company_profiles` (`parentCompanyId`);