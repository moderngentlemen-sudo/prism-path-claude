CREATE TABLE `friends` (
	`uid` text NOT NULL,
	`friend` text NOT NULL,
	PRIMARY KEY(`uid`, `friend`)
);
--> statement-breakpoint
CREATE TABLE `pulse_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` text NOT NULL,
	`week` integer NOT NULL,
	`score` integer NOT NULL,
	`boards` integer NOT NULL,
	`turns` integer NOT NULL,
	`seconds` real NOT NULL,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pulse_week` ON `pulse_runs` (`week`,`score`);--> statement-breakpoint
CREATE TABLE `stats` (
	`day` text NOT NULL,
	`puzzle` text NOT NULL,
	`kind` text NOT NULL,
	`n` integer NOT NULL,
	PRIMARY KEY(`day`, `puzzle`, `kind`)
);
--> statement-breakpoint
ALTER TABLE `best` ADD `radiant` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `best` ADD `perfect` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finishes` ADD `radiant` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finishes` ADD `perfect` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `finishes` ADD `version` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
CREATE INDEX `finishes_puzzle` ON `finishes` (`puzzle`);--> statement-breakpoint
ALTER TABLE `players` ADD `code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `players_code` ON `players` (`code`);