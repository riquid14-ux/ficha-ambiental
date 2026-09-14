ALTER TABLE `operation_infrastructure_points` ADD `technicalDataJson` text;--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `invoiceTypesJson` text;--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `chartDataJson` text;--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `chartFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `chartFileUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `chartFileName` varchar(255);
