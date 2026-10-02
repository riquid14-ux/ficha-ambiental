ALTER TABLE `monitoring_plans` ADD `apaReceivedAt` bigint;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `apaSubmissionDueAt` bigint;--> statement-breakpoint
ALTER TABLE `monitoring_plans` ADD `apaSubmittedAt` bigint;--> statement-breakpoint
CREATE INDEX `monitoring_plans_apa_due_idx` ON `monitoring_plans` (`apaSubmissionDueAt`);