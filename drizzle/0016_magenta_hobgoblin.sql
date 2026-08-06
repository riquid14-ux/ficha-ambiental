ALTER TABLE `monitoring_plans` ADD `submissionStatus` enum('pending','submitted','delivered') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `submittedFileUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `submittedFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `submittedAt` bigint;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `confirmedDeliveryAt` bigint;