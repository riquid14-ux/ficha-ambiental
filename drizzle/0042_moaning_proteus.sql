CREATE TABLE `operation_import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceFilename` varchar(255) NOT NULL,
	`sourceFileKey` varchar(500) NOT NULL,
	`sourceFileUrl` text NOT NULL,
	`sourceType` enum('daily_report','bms_extract','manual_import') NOT NULL DEFAULT 'daily_report',
	`measuredDate` varchar(10),
	`rowsImported` int NOT NULL DEFAULT 0,
	`qualityStatus` enum('valid','warning','invalid') NOT NULL DEFAULT 'valid',
	`qualityNotes` text,
	`importedBy` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`invoiceType` enum('electricidade','agua_potavel','agua_industrial','hvo','gasoleo','outro') NOT NULL,
	`supplier` varchar(255),
	`invoiceNumber` varchar(120),
	`periodStart` varchar(10) NOT NULL,
	`periodEnd` varchar(10) NOT NULL,
	`quantity` varchar(80) NOT NULL,
	`unit` varchar(50) NOT NULL,
	`totalCost` varchar(80),
	`currency` varchar(8) NOT NULL DEFAULT 'EUR',
	`fileKey` varchar(500),
	`fileUrl` text,
	`filename` varchar(255),
	`mimeType` varchar(100),
	`reconciliationStatus` enum('por_reconciliar','conforme','desvio','incompleta') NOT NULL DEFAULT 'por_reconciliar',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_readings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`batchId` int,
	`metricCode` varchar(100) NOT NULL,
	`metricLabel` varchar(255) NOT NULL,
	`category` enum('energia','agua','arrefecimento','carbono','conformidade','custo') NOT NULL,
	`unit` varchar(50) NOT NULL,
	`value` varchar(80) NOT NULL,
	`measuredAt` bigint NOT NULL,
	`granularity` enum('quinze_minutos','diario','mensal','anual') NOT NULL DEFAULT 'diario',
	`source` enum('bms_report','invoice','manual','calculated') NOT NULL DEFAULT 'bms_report',
	`dataQuality` enum('valid','warning','invalid') NOT NULL DEFAULT 'valid',
	`qualityNote` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_readings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operation_readings_unique` UNIQUE(`projectId`,`metricCode`,`measuredAt`,`granularity`,`source`)
);
--> statement-breakpoint
CREATE TABLE `operation_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`coolingStrategy` enum('agua_mar','chiller','hibrido_adiabatico','torres_evaporativas','outro') NOT NULL,
	`assumptionsJson` text NOT NULL,
	`resultJson` text NOT NULL,
	`baselineStart` varchar(10),
	`baselineEnd` varchar(10),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operation_import_batches_project_date_idx` ON `operation_import_batches` (`projectId`,`measuredDate`);--> statement-breakpoint
CREATE INDEX `operation_invoices_project_period_idx` ON `operation_invoices` (`projectId`,`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE INDEX `operation_invoices_project_type_idx` ON `operation_invoices` (`projectId`,`invoiceType`);--> statement-breakpoint
CREATE INDEX `operation_readings_project_metric_date_idx` ON `operation_readings` (`projectId`,`metricCode`,`measuredAt`);--> statement-breakpoint
CREATE INDEX `operation_readings_batch_idx` ON `operation_readings` (`batchId`);--> statement-breakpoint
CREATE INDEX `operation_scenarios_project_created_idx` ON `operation_scenarios` (`projectId`,`createdAt`);