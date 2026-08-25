CREATE TABLE `e2ee_bundles` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`ik_pub` text NOT NULL,
	`ed_pub` text NOT NULL,
	`spk_pub` text NOT NULL,
	`spk_sig` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
