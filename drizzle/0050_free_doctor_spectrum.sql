ALTER TABLE `operation_infrastructure_points` ADD `cardLayout` varchar(32) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `cardAccent` varchar(32) DEFAULT 'teal' NOT NULL;--> statement-breakpoint
ALTER TABLE `operation_infrastructure_points` ADD `cardImageUrl` varchar(1000);