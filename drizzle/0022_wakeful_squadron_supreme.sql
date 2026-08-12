CREATE TABLE `waste_egars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`date` bigint NOT NULL,
	`egarId` varchar(100),
	`egarLink` varchar(500),
	`operator` varchar(255),
	`lerCode` varchar(20) NOT NULL,
	`designation` varchar(500) NOT NULL,
	`quantity` varchar(50) NOT NULL,
	`destination` enum('recycled','incinerated','landfill') DEFAULT 'recycled',
	`month` int NOT NULL,
	`year` int NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waste_egars_id` PRIMARY KEY(`id`)
);
