ALTER TABLE `operation_settings` ADD `electricityPriceEurKwh` varchar(80);--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `waterPriceEurM3` varchar(80);--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `annualMaintenanceBudgetEur` varchar(80);--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `targetPue` varchar(80);--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `targetWueLkwh` varchar(80);--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `forecastHorizonDays` int;--> statement-breakpoint
ALTER TABLE `operation_settings` ADD `coolingStrategyBaseline` varchar(40);