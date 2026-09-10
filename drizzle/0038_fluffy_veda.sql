ALTER TABLE `document_library` ADD `isProjectCentral` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_library` ADD `isMandatoryRead` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_library` ADD `centralOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `document_library_central_idx` ON `document_library` (`status`,`isProjectCentral`,`centralOrder`);