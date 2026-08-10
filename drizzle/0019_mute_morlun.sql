ALTER TABLE `calendar_events` ADD `status` enum('pending','reported','confirmed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `ownerId` int;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `ownerName` varchar(255);