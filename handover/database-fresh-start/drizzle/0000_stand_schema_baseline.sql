CREATE TABLE `apa_reporting_cycle_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cycleId` int NOT NULL,
	`planId` int NOT NULL,
	`addedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apa_reporting_cycle_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `apa_reporting_cycle_plan_uq` UNIQUE(`cycleId`,`planId`)
);
--> statement-breakpoint
CREATE TABLE `apa_reporting_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`calendarEventId` int NOT NULL,
	`occurrenceAt` bigint NOT NULL,
	`projectId` int,
	`reportType` enum('rdcd','relatorio_anual_dcape','outro') NOT NULL DEFAULT 'rdcd',
	`receivedAt` bigint,
	`submissionDueAt` bigint,
	`submittedAt` bigint,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apa_reporting_cycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `apa_reporting_cycle_occurrence_uq` UNIQUE(`calendarEventId`,`occurrenceAt`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text,
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`action` varchar(255) NOT NULL,
	`entity` varchar(255),
	`entityId` int,
	`oldValue` text,
	`newValue` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`name` varchar(500) NOT NULL,
	`description` text,
	`periodicity` varchar(100),
	`firstDate` bigint NOT NULL,
	`nextDate` bigint,
	`lastDeliveredDate` bigint,
	`category` varchar(100),
	`status` enum('pending','reported','confirmed') NOT NULL DEFAULT 'pending',
	`ownerId` int,
	`ownerName` varchar(255),
	`sourceType` varchar(50),
	`sourceId` int,
	`sourceKey` varchar(255),
	`entityToDeliver` varchar(500),
	`entityLink` varchar(1000),
	`active` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_events_source_project_uq` UNIQUE(`sourceType`,`sourceId`,`projectId`),
	CONSTRAINT `calendar_events_source_key_uq` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `calendar_reminder_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`deadlineDate` bigint NOT NULL,
	`reminderDays` int NOT NULL,
	`recipientUserId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_reminder_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_reminder_logs_unique` UNIQUE(`eventId`,`deadlineDate`,`reminderDays`,`recipientEmail`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`shortName` varchar(50) NOT NULL,
	`companyType` enum('ee','ee_partner','rap','dono_obra','raa','pm','observador') NOT NULL DEFAULT 'ee',
	`logoUrl` text,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deletion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`projectId` int,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`companyId` int,
	`companyName` varchar(255),
	`createdBy` int,
	`deletedBy` int NOT NULL,
	`deletedByName` varchar(255),
	`deletedByEmail` varchar(255),
	`reason` text,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	`recoveredAt` bigint,
	CONSTRAINT `deletion_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` enum('obrigacoes_ambientais','certificacoes','recomendacoes') NOT NULL,
	`subtopic` varchar(100),
	`title` varchar(255) NOT NULL,
	`language` varchar(50) NOT NULL,
	`description` text,
	`appliesToAllProjects` int NOT NULL DEFAULT 0,
	`fileKey` varchar(500) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`isProjectCentral` int NOT NULL DEFAULT 0,
	`isMandatoryRead` int NOT NULL DEFAULT 0,
	`centralOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_library_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`projectId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_library_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_library_project_unique` UNIQUE(`documentId`,`projectId`)
);
--> statement-breakpoint
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
CREATE TABLE `evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`responseId` int NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_files_id` PRIMARY KEY(`id`)
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
CREATE TABLE `historical_pdfs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
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
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`companyId` int NOT NULL,
	`role` enum('user','admin','ee','ee_partner','raa','rap','dono_obra','observador','pm') NOT NULL DEFAULT 'ee',
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(500) NOT NULL,
	`date` varchar(10) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'aberto',
	`severity` varchar(50) NOT NULL DEFAULT 'baixo',
	`link` varchar(1000),
	`createdBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_metrics` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`nameEn` varchar(500),
	`unit` varchar(50) NOT NULL,
	`target` varchar(255),
	`category` varchar(100) NOT NULL,
	`inputType` varchar(20) NOT NULL DEFAULT 'manual',
	`formulaType` varchar(50),
	`formulaSourceMetricId` int,
	`pci` varchar(50),
	`emissionFactor` varchar(50),
	`density` varchar(50),
	`sortOrder` int DEFAULT 0,
	`active` int DEFAULT 1,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `kpi_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_submission_changes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`action` varchar(40) NOT NULL,
	`actorId` int NOT NULL,
	`actorName` varchar(255) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`changedValues` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_submission_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_submissions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`companyId` int NOT NULL,
	`parentCompanyId` int,
	`sourceType` enum('ee','ee_partner') NOT NULL DEFAULT 'ee',
	`userId` int,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`status` varchar(20) DEFAULT 'submitted',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kpi_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `kpi_submissions_contribution_unique` UNIQUE(`projectId`,`companyId`,`weekNumber`,`weekYear`)
);
--> statement-breakpoint
CREATE TABLE `kpi_targets` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`metricId` int NOT NULL,
	`projectId` int NOT NULL,
	`targetType` varchar(20) NOT NULL DEFAULT 'monthly',
	`targetValue` varchar(255) NOT NULL,
	`targetDirection` varchar(10) NOT NULL DEFAULT 'max',
	`year` int NOT NULL,
	`month` int,
	`createdBy` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kpi_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kpi_values` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`submissionId` int NOT NULL,
	`metricId` int NOT NULL,
	`value` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `kpi_values_id` PRIMARY KEY(`id`)
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
CREATE TABLE `measures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`catalogueScope` enum('weekly','dcape') NOT NULL DEFAULT 'weekly',
	`number` varchar(20) NOT NULL,
	`description` text NOT NULL,
	`responsible` varchar(50) NOT NULL,
	`sectionId` int NOT NULL,
	`orderIndex` int NOT NULL,
	CONSTRAINT `measures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int,
	`ownerName` varchar(255),
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`lastReportingDate` bigint,
	`nextReportingDate` bigint,
	`submissionStatus` enum('pending','submitted','delivered') NOT NULL DEFAULT 'pending',
	`confirmedDeliveryAt` bigint,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_plan_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitoring_plan_assignments_plan_project_uq` UNIQUE(`planId`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int,
	`planId` int,
	`updateId` int,
	`type` enum('photo','file') NOT NULL DEFAULT 'file',
	`fileKey` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(255) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_plan_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plan_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int,
	`planId` int,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_plan_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`planNumber` varchar(50),
	`name` varchar(500) NOT NULL,
	`category` enum('programa_monitorizacao','plano_projeto') NOT NULL DEFAULT 'programa_monitorizacao',
	`periodicity` varchar(100),
	`phase` varchar(100) NOT NULL DEFAULT 'construcao',
	`ownerId` int,
	`ownerName` varchar(255),
	`supportName` varchar(255),
	`supportCompany` varchar(255),
	`supportEmail` varchar(320),
	`supportPhone` varchar(80),
	`trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`lastReportingDate` bigint,
	`nextReportingDate` bigint,
	`apaReceivedAt` bigint,
	`apaSubmissionDueAt` bigint,
	`apaSubmittedAt` bigint,
	`apaReportType` enum('rdcd','relatorio_anual_dcape','outro') NOT NULL DEFAULT 'rdcd',
	`notes` text,
	`submissionStatus` enum('pending','submitted','delivered') NOT NULL DEFAULT 'pending',
	`submittedFileUrl` varchar(1000),
	`submittedFileKey` varchar(500),
	`submittedAt` bigint,
	`confirmedDeliveryAt` bigint,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitoring_plans_plan_number_uq` UNIQUE(`planNumber`)
);
--> statement-breakpoint
CREATE TABLE `notification_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`notificationType` varchar(50) NOT NULL DEFAULT 'submission',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `notification_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_bms_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`eventId` varchar(120) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`batchId` int,
	`receivedAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_bms_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `operation_bms_events_project_event_unique` UNIQUE(`projectId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `operation_chemical_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`chemicalName` varchar(255) NOT NULL,
	`quantity` varchar(80) NOT NULL,
	`unit` varchar(40) NOT NULL,
	`safetyThreshold` varchar(80),
	`location` varchar(255),
	`notes` text,
	`isDemo` boolean NOT NULL DEFAULT false,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_chemical_inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
	`isDemo` boolean NOT NULL DEFAULT false,
	`importedBy` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_infrastructure_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`subtitle` varchar(255),
	`systemType` varchar(80) NOT NULL DEFAULT 'infraestrutura',
	`status` varchar(40) NOT NULL DEFAULT 'operacional',
	`xPercent` int NOT NULL,
	`yPercent` int NOT NULL,
	`description` text,
	`metricCodesJson` text NOT NULL,
	`chartMetricCode` varchar(100),
	`documentTitle` varchar(255),
	`documentUrl` varchar(1000),
	`technicalNote` text,
	`technicalDataJson` text,
	`invoiceTypesJson` text,
	`chartDataJson` text,
	`chartFileKey` varchar(500),
	`chartFileUrl` varchar(1000),
	`chartFileName` varchar(255),
	`cardLayout` varchar(32) NOT NULL DEFAULT 'standard',
	`cardAccent` varchar(32) NOT NULL DEFAULT 'teal',
	`cardImageKey` varchar(500),
	`cardImageUrl` varchar(1000),
	`isFuture` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_infrastructure_points_id` PRIMARY KEY(`id`)
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
	`isDemo` boolean NOT NULL DEFAULT false,
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
	`isDemo` boolean NOT NULL DEFAULT false,
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
	`isDemo` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`configurationMode` varchar(20) NOT NULL DEFAULT 'approved',
	`electricityCarbonFactorKgKwh` varchar(80),
	`waterPotableCarbonFactorKgM3` varchar(80),
	`waterIndustrialCarbonFactorKgM3` varchar(80),
	`maxPue` varchar(80),
	`maxSeawaterReturnTempC` varchar(80),
	`minSeawaterFlowLps` varchar(80),
	`maxSeawaterFlowLps` varchar(80),
	`maxSeawaterDeltaTK` varchar(80),
	`electricityPriceEurKwh` varchar(80),
	`waterPriceEurM3` varchar(80),
	`annualMaintenanceBudgetEur` varchar(80),
	`targetPue` varchar(80),
	`targetWueLkwh` varchar(80),
	`forecastHorizonDays` int,
	`coolingStrategyBaseline` varchar(40),
	`infrastructureFutureAreaJson` text,
	`infrastructureMapLabelsJson` text,
	`operationImportMappingJson` text,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operation_settings_project_unique` UNIQUE(`projectId`)
);
--> statement-breakpoint
CREATE TABLE `operation_sustainability_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`recordedAt` varchar(10) NOT NULL,
	`hvoLiters` varchar(80),
	`dieselLiters` varchar(80),
	`absoluteCo2Tonnes` varchar(80),
	`notes` text,
	`isDemo` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operation_sustainability_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operational_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','investigating','monitoring','resolved') NOT NULL DEFAULT 'open',
	`affectedServices` varchar(500) NOT NULL DEFAULT 'Aplicação',
	`impactSummary` text,
	`recoverySteps` text,
	`followUpActions` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_incidents_id` PRIMARY KEY(`id`)
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
CREATE TABLE `phase_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measureId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` enum('comment','photo','file') NOT NULL,
	`content` text,
	`fileKey` varchar(500),
	`filename` varchar(255),
	`mimeType` varchar(100),
	`category` varchar(120),
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`referenceYear` int,
	CONSTRAINT `phase_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phase_measure_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measureId` int NOT NULL,
	`projectId` int NOT NULL,
	`status` enum('pendente','em_curso','concluido') NOT NULL DEFAULT 'pendente',
	`notes` text,
	`ownerId` int,
	`ownerName` varchar(255),
	`supportName` varchar(255),
	`supportCompany` varchar(255),
	`supportEmail` varchar(320),
	`supportPhone` varchar(80),
	`trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`firstDeliveryDate` bigint,
	`lastDeliveryDate` bigint,
	`nextDeliveryDate` bigint,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phase_measure_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `phase_measure_statuses_project_measure_uq` UNIQUE(`projectId`,`measureId`)
);
--> statement-breakpoint
CREATE TABLE `phase_measure_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`measureId` int NOT NULL,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phase_measure_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`companyId` int NOT NULL,
	`startWeek` int,
	`startYear` int,
	`endWeek` int,
	`endYear` int,
	`bufferWeeks` int DEFAULT 4,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_phase_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phaseId` int NOT NULL,
	`status` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL,
	`updateText` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_phase_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_phases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`phaseKey` varchar(100) NOT NULL,
	`phaseName` varchar(255) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`orderIndex` int NOT NULL DEFAULT 0,
	`startDate` varchar(10),
	`endDate` varchar(10),
	`hidden` int NOT NULL DEFAULT 0,
	`progress` int NOT NULL DEFAULT 0,
	`ownerId` int,
	`ownerName` varchar(255),
	`supportName` varchar(255),
	`supportCompany` varchar(255),
	`supportEmail` varchar(320),
	`supportPhone` varchar(80),
	`trackingStatus` enum('nao_iniciado','em_curso','em_validacao','concluido','bloqueado') NOT NULL DEFAULT 'nao_iniciado',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_phases_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_phases_project_key_uq` UNIQUE(`projectId`,`phaseKey`)
);
--> statement-breakpoint
CREATE TABLE `project_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`accessModules` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`workflowDescription` text,
	`enabledModules` varchar(1000) NOT NULL DEFAULT '["dashboard","calendar","map","timeline","ficha","residuos","kpi"]',
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `rdcd_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`reportNumber` varchar(160),
	`reportYear` int NOT NULL,
	`startWeek` int NOT NULL,
	`endWeek` int NOT NULL,
	`reportPhase` varchar(160) NOT NULL,
	`revision` varchar(40) NOT NULL DEFAULT 'draft',
	`brandProfile` varchar(80) NOT NULL DEFAULT 'startcampus_gleeds_quadrante',
	`preparedBy` varchar(500),
	`reviewedBy` varchar(500),
	`contentJson` text NOT NULL,
	`selectionJson` text NOT NULL,
	`planIdsJson` text NOT NULL,
	`includePlans` boolean NOT NULL DEFAULT true,
	`includeWaste` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rdcd_reports_id` PRIMARY KEY(`id`)
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
CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`catalogueScope` enum('weekly','dcape') NOT NULL DEFAULT 'weekly',
	`name` varchar(500) NOT NULL,
	`orderIndex` int NOT NULL,
	`phase` varchar(100) NOT NULL,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_feedback` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(255),
	`userEmail` varchar(255),
	`content` text NOT NULL,
	`category` varchar(50) DEFAULT 'melhoria',
	`status` varchar(50) DEFAULT 'pendente',
	`adminNotes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `user_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin','ee','ee_partner','raa','rap','dono_obra','observador','pm') NOT NULL DEFAULT 'user',
	`companyId` int,
	`fullName` varchar(255),
	`jobTitle` varchar(255),
	`passwordHash` varchar(255),
	`mustChangePassword` int DEFAULT 0,
	`totpSecret` varchar(255),
	`totpEnabled` int DEFAULT 0,
	`twoFactorGraceUntil` timestamp,
	`accountStatus` varchar(20) DEFAULT 'active',
	`sessionVersion` int NOT NULL DEFAULT 0,
	`passwordResetToken` varchar(255),
	`passwordResetExpiry` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `waste_egars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`subProjectId` int,
	`companyId` int,
	`parentCompanyId` int,
	`date` bigint NOT NULL,
	`egarId` varchar(100),
	`egarLink` varchar(500),
	`operator` varchar(255),
	`lerCode` varchar(20) NOT NULL,
	`designation` varchar(500) NOT NULL,
	`quantity` varchar(50) NOT NULL,
	`destination` enum('recycled','incinerated','landfill') DEFAULT 'recycled',
	`correctedQuantity` varchar(50),
	`month` int NOT NULL,
	`year` int NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waste_egars_id` PRIMARY KEY(`id`)
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
CREATE TABLE `weekly_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`weekStartDate` varchar(10) NOT NULL,
	`weekEndDate` varchar(10) NOT NULL,
	`status` enum('draft','submitted','under_review','approved','rejected','deleted') NOT NULL DEFAULT 'draft',
	`submittedBy` int,
	`createdBy` int,
	`submittedAt` bigint,
	`reviewedBy` int,
	`reviewedAt` bigint,
	`reviewNotes` text,
	`deletedAt` bigint,
	`deletedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weeks_without_work` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`weekYear` int NOT NULL,
	`reason` varchar(255),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weeks_without_work_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `apa_reporting_cycle_plan_idx` ON `apa_reporting_cycle_plans` (`planId`);--> statement-breakpoint
CREATE INDEX `apa_reporting_cycle_due_idx` ON `apa_reporting_cycles` (`submissionDueAt`);--> statement-breakpoint
CREATE INDEX `calendar_events_owner_idx` ON `calendar_events` (`ownerId`);--> statement-breakpoint
CREATE INDEX `calendar_events_next_date_idx` ON `calendar_events` (`nextDate`);--> statement-breakpoint
CREATE INDEX `calendar_reminder_logs_event_idx` ON `calendar_reminder_logs` (`eventId`);--> statement-breakpoint
CREATE INDEX `document_library_status_topic_idx` ON `document_library` (`status`,`topic`);--> statement-breakpoint
CREATE INDEX `document_library_central_idx` ON `document_library` (`status`,`isProjectCentral`,`centralOrder`);--> statement-breakpoint
CREATE INDEX `document_library_topic_subtopic_idx` ON `document_library` (`topic`,`subtopic`);--> statement-breakpoint
CREATE INDEX `document_library_created_idx` ON `document_library` (`createdAt`);--> statement-breakpoint
CREATE INDEX `document_library_project_idx` ON `document_library_projects` (`projectId`,`documentId`);--> statement-breakpoint
CREATE INDEX `eep_request_users_request_idx` ON `eep_request_users` (`requestId`);--> statement-breakpoint
CREATE INDEX `eep_requests_parent_company_idx` ON `eep_requests` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `eep_requests_requester_idx` ON `eep_requests` (`requestedByUserId`);--> statement-breakpoint
CREATE INDEX `eep_requests_status_idx` ON `eep_requests` (`status`);--> statement-breakpoint
CREATE INDEX `evidence_files_file_key_idx` ON `evidence_files` (`fileKey`);--> statement-breakpoint
CREATE INDEX `evidence_images_file_key_idx` ON `evidence_images` (`fileKey`);--> statement-breakpoint
CREATE INDEX `historical_pdfs_file_key_idx` ON `historical_pdfs` (`fileKey`);--> statement-breakpoint
CREATE INDEX `kpi_submission_changes_submission_idx` ON `kpi_submission_changes` (`submissionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `kpi_submissions_parent_company_idx` ON `kpi_submissions` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `measures_project_scope_section_order_idx` ON `measures` (`projectId`,`catalogueScope`,`sectionId`,`orderIndex`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_project_idx` ON `monitoring_plan_assignments` (`projectId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_owner_idx` ON `monitoring_plan_assignments` (`ownerId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_assignments_due_idx` ON `monitoring_plan_assignments` (`nextReportingDate`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_assignment_idx` ON `monitoring_plan_attachments` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_plan_idx` ON `monitoring_plan_attachments` (`planId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_update_idx` ON `monitoring_plan_attachments` (`updateId`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_file_key_idx` ON `monitoring_plan_attachments` (`fileKey`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_updates_assignment_created_idx` ON `monitoring_plan_updates` (`assignmentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_updates_plan_created_idx` ON `monitoring_plan_updates` (`planId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `monitoring_plans_apa_due_idx` ON `monitoring_plans` (`apaSubmissionDueAt`);--> statement-breakpoint
CREATE INDEX `operation_bms_events_batch_idx` ON `operation_bms_events` (`batchId`);--> statement-breakpoint
CREATE INDEX `operation_chemical_inventory_project_name_idx` ON `operation_chemical_inventory` (`projectId`,`chemicalName`);--> statement-breakpoint
CREATE INDEX `operation_import_batches_project_date_idx` ON `operation_import_batches` (`projectId`,`measuredDate`);--> statement-breakpoint
CREATE INDEX `operation_import_batches_source_file_key_idx` ON `operation_import_batches` (`sourceFileKey`);--> statement-breakpoint
CREATE INDEX `operation_infrastructure_points_project_order_idx` ON `operation_infrastructure_points` (`projectId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `operation_infrastructure_card_image_key_idx` ON `operation_infrastructure_points` (`cardImageKey`);--> statement-breakpoint
CREATE INDEX `operation_infrastructure_chart_file_key_idx` ON `operation_infrastructure_points` (`chartFileKey`);--> statement-breakpoint
CREATE INDEX `operation_invoices_project_period_idx` ON `operation_invoices` (`projectId`,`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE INDEX `operation_invoices_project_type_idx` ON `operation_invoices` (`projectId`,`invoiceType`);--> statement-breakpoint
CREATE INDEX `operation_invoices_file_key_idx` ON `operation_invoices` (`fileKey`);--> statement-breakpoint
CREATE INDEX `operation_readings_project_metric_date_idx` ON `operation_readings` (`projectId`,`metricCode`,`measuredAt`);--> statement-breakpoint
CREATE INDEX `operation_readings_batch_idx` ON `operation_readings` (`batchId`);--> statement-breakpoint
CREATE INDEX `operation_scenarios_project_created_idx` ON `operation_scenarios` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operation_sustainability_snapshot_project_recorded_idx` ON `operation_sustainability_snapshots` (`projectId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `operational_incidents_status_occurred_idx` ON `operational_incidents` (`status`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `partner_access_profiles_parent_company_idx` ON `partner_access_profiles` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `partner_company_profiles_parent_idx` ON `partner_company_profiles` (`parentCompanyId`);--> statement-breakpoint
CREATE INDEX `phase_evidence_file_key_idx` ON `phase_evidence` (`fileKey`);--> statement-breakpoint
CREATE INDEX `phase_measure_statuses_owner_idx` ON `phase_measure_statuses` (`ownerId`);--> statement-breakpoint
CREATE INDEX `phase_measure_updates_project_measure_created_idx` ON `phase_measure_updates` (`projectId`,`measureId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `phase_measure_updates_created_idx` ON `phase_measure_updates` (`createdAt`);--> statement-breakpoint
CREATE INDEX `project_phase_updates_phase_idx` ON `project_phase_updates` (`phaseId`);--> statement-breakpoint
CREATE INDEX `project_phase_updates_created_idx` ON `project_phase_updates` (`createdAt`);--> statement-breakpoint
CREATE INDEX `project_phases_owner_idx` ON `project_phases` (`ownerId`);--> statement-breakpoint
CREATE INDEX `rdcd_reports_project_period_idx` ON `rdcd_reports` (`projectId`,`reportYear`,`startWeek`,`endWeek`);--> statement-breakpoint
CREATE INDEX `rdcd_reports_updated_idx` ON `rdcd_reports` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `sections_project_scope_order_idx` ON `sections` (`projectId`,`catalogueScope`,`orderIndex`);--> statement-breakpoint
CREATE INDEX `waste_egars_project_year_idx` ON `waste_egars` (`projectId`,`year`);--> statement-breakpoint
CREATE INDEX `waste_egars_subproject_idx` ON `waste_egars` (`subProjectId`);--> statement-breakpoint
CREATE INDEX `waste_egars_company_idx` ON `waste_egars` (`companyId`);--> statement-breakpoint
CREATE INDEX `waste_subprojects_project_idx` ON `waste_subprojects` (`projectId`);