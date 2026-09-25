ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `evidence_files_file_key_idx` ON `evidence_files` (`fileKey`);--> statement-breakpoint
CREATE INDEX `evidence_images_file_key_idx` ON `evidence_images` (`fileKey`);--> statement-breakpoint
CREATE INDEX `historical_pdfs_file_key_idx` ON `historical_pdfs` (`fileKey`);--> statement-breakpoint
CREATE INDEX `monitoring_plan_attachments_file_key_idx` ON `monitoring_plan_attachments` (`fileKey`);--> statement-breakpoint
CREATE INDEX `operation_import_batches_source_file_key_idx` ON `operation_import_batches` (`sourceFileKey`);--> statement-breakpoint
CREATE INDEX `operation_infrastructure_card_image_key_idx` ON `operation_infrastructure_points` (`cardImageKey`);--> statement-breakpoint
CREATE INDEX `operation_infrastructure_chart_file_key_idx` ON `operation_infrastructure_points` (`chartFileKey`);--> statement-breakpoint
CREATE INDEX `operation_invoices_file_key_idx` ON `operation_invoices` (`fileKey`);--> statement-breakpoint
CREATE INDEX `phase_evidence_file_key_idx` ON `phase_evidence` (`fileKey`);