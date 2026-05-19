CREATE TABLE `affiliateLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceName` varchar(256) NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`category` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliateLinks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`driveFileId` varchar(256) NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`mimeType` varchar(128),
	`fileSize` int,
	`thumbnailUrl` text,
	`webViewLink` text,
	`assetType` enum('artwork','mockup') NOT NULL,
	`analysisStatus` enum('pending','analyzing','completed','failed') NOT NULL DEFAULT 'pending',
	`subject` varchar(256),
	`genre` varchar(128),
	`style` varchar(128),
	`audience` varchar(128),
	`roomType` varchar(128),
	`colorPalette` json,
	`emotionalVibe` varchar(256),
	`lineWeight` varchar(64),
	`lighting` varchar(128),
	`tags` json,
	`aiAnalysisRaw` json,
	`analyzedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_driveFileId_unique` UNIQUE(`driveFileId`)
);
--> statement-breakpoint
CREATE TABLE `bundleAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` int NOT NULL,
	`assetId` int NOT NULL,
	`position` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundleAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`bundleType` enum('end_user','commercial') NOT NULL DEFAULT 'commercial',
	`status` enum('proposed','draft','finalized','published') NOT NULL DEFAULT 'proposed',
	`genre` varchar(128),
	`targetAudience` varchar(256),
	`price` int DEFAULT 2700,
	`artworkCount` int DEFAULT 0,
	`pdfUrl` text,
	`zipUrl` text,
	`packagedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bundles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driveConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiry` timestamp,
	`email` varchar(320),
	`connected` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driveConnections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailDrafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bundleId` int,
	`emailType` enum('post_purchase','promotional','newsletter') NOT NULL,
	`subject` varchar(512) NOT NULL,
	`body` text NOT NULL,
	`status` enum('draft','approved','sent') NOT NULL DEFAULT 'draft',
	`sequenceOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mockupPairings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundleId` int NOT NULL,
	`artworkAssetId` int NOT NULL,
	`mockupAssetId` int NOT NULL,
	`compositeUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mockupPairings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mockupRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`genre` varchar(128) NOT NULL,
	`mockupStyle` varchar(256) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mockupRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`folderType` enum('artwork','mockup') NOT NULL,
	`folderId` varchar(256) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`totalFiles` int DEFAULT 0,
	`processedFiles` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scanJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `socialPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bundleId` int,
	`platform` enum('instagram','pinterest') NOT NULL,
	`postType` enum('static','carousel','reel') NOT NULL,
	`caption` text,
	`hashtags` text,
	`hookLine` varchar(512),
	`reelScript` text,
	`imageUrls` json,
	`status` enum('draft','scheduled','posted') NOT NULL DEFAULT 'draft',
	`scheduledFor` timestamp,
	`postedAt` timestamp,
	`calendarDay` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `socialPosts_id` PRIMARY KEY(`id`)
);
