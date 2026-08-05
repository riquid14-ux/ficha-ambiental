CREATE TABLE `phase_measure_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measureId` int NOT NULL,
	`projectId` int NOT NULL,
	`status` enum('pendente','em_curso','concluido') NOT NULL DEFAULT 'pendente',
	`notes` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `phase_measure_statuses_id` PRIMARY KEY(`id`)
);
