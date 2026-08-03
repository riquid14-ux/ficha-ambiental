ALTER TABLE `historical_pdfs` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `projectId` int;--> statement-breakpoint
ALTER TABLE `weekly_submissions` ADD `createdBy` int;