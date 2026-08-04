ALTER TABLE `weekly_submissions` MODIFY COLUMN `status` enum('draft','submitted','under_review','approved','rejected','deleted') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `deletedAt` bigint;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `deletedBy` int;