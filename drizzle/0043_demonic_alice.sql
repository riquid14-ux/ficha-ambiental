CREATE TABLE `operation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`electricityCarbonFactorKgKwh` varchar(80),
	`waterPotableCarbonFactorKgM3` varchar(80),
	`waterIndustrialCarbonFactorKgM3` varchar(80),
	`maxPue` varchar(80),
	`maxSeawaterReturnTempC` varchar(80),
	`minSeawaterFlowLps` varchar(80),
	`maxSeawaterFlowLps` varchar(80),
	`maxSeawaterDeltaTK` varchar(80),
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operation_settings_project_unique` UNIQUE(`projectId`)
);
