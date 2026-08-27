CREATE TABLE `map_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`projectId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`relativeAltitudeM` varchar(50),
	`imageWidth` int,
	`imageHeight` int,
	`metadataJson` text,
	`capturedAt` bigint,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `map_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `map_surveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`capturedAt` bigint,
	`status` enum('draft','ready','processing','published','failed') NOT NULL DEFAULT 'draft',
	`resultType` enum('photo_layers','orthomosaic') NOT NULL DEFAULT 'photo_layers',
	`orthomosaicFileKey` varchar(500),
	`orthomosaicUrl` text,
	`orthomosaicBoundsJson` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `map_surveys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_access_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`parentCompanyId` int NOT NULL,
	`allowKpi` boolean NOT NULL DEFAULT false,
	`allowWaste` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`configuredBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_access_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_access_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `project_map_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`baseMapFileKey` varchar(500),
	`baseMapUrl` text,
	`boundsJson` text,
	`sourceName` varchar(255),
	`sourceUrl` text,
	`attribution` varchar(500),
	`license` varchar(255),
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_map_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_map_settings_project_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `waste_subprojects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(80),
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waste_subprojects_id` PRIMARY KEY(`id`),
	CONSTRAINT `waste_subprojects_project_name_unique` UNIQUE(`projectId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `companies` MODIFY COLUMN `companyType` enum('ee','ee_partner','rap','dono_obra','raa','observador') NOT NULL DEFAULT 'ee';--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('user','admin','ee','ee_partner','raa','rap','dono_obra','observador','pm') NOT NULL DEFAULT 'ee';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','ee','ee_partner','raa','rap','dono_obra','observador','pm') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `kpi_submissions` ADD `parentCompanyId` int;--> statement-breakpoint
ALTER TABLE `kpi_submissions` ADD `sourceType` enum('ee','ee_partner') DEFAULT 'ee' NOT NULL;--> statement-breakpoint
ALTER TABLE `waste_egars` ADD `subProjectId` int;--> statement-breakpoint
ALTER TABLE `waste_egars` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `waste_egars` ADD `parentCompanyId` int;--> statement-breakpoint
ALTER TABLE `kpi_submissions` ADD CONSTRAINT `kpi_submissions_contribution_unique` UNIQUE(`projectId`,`companyId`,`weekNumber`,`weekYear`);--> statement-breakpoint
CREATE INDEX `map_photos_survey_idx` ON `map_photos` (`surveyId`);--> statement-breakpoint
CREATE INDEX `map_photos_project_idx` ON `map_photos` (`projectId`);--> statement-breakpoint
CREATE INDEX `map_surveys_project_captured_idx` ON `map_surveys` (`projectId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `partner_access_profiles_parent_company_idx` ON `partner_access_profiles` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `waste_subprojects_project_idx` ON `waste_subprojects` (`projectId`);--> statement-breakpoint
CREATE INDEX `kpi_submissions_parent_company_idx` ON `kpi_submissions` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `waste_egars_project_year_idx` ON `waste_egars` (`projectId`,`year`);--> statement-breakpoint
CREATE INDEX `waste_egars_subproject_idx` ON `waste_egars` (`subProjectId`);--> statement-breakpoint
CREATE INDEX `waste_egars_company_idx` ON `waste_egars` (`companyId`);