CREATE DATABASE IF NOT EXISTS `readitla_ril-tmp`;
USE `readitla_ril-tmp`;

CREATE TABLE `curated_feed_prospects` (
  `prospect_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `feed_id` int(10) unsigned NOT NULL DEFAULT '0',
  `resolved_id` int(10) unsigned NOT NULL,
  `type` varchar(50) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `status` enum('ready','approved','denied','unapproved') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'ready',
  `curator` varchar(50) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `time_added` int(11) DEFAULT '0',
  `time_updated` int(11) DEFAULT '0',
  `top_domain_id` int(10) unsigned DEFAULT NULL,
  `title` varchar(200) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `excerpt` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
  `image_src` text CHARACTER SET utf8 COLLATE utf8_unicode_ci,
  PRIMARY KEY (`prospect_id`),
  UNIQUE KEY `resolved_idx` (`feed_id`,`resolved_id`),
  KEY `domain_title_idx` (`feed_id`,`top_domain_id`,`title`)
) ENGINE=InnoDB AUTO_INCREMENT=298813 DEFAULT CHARSET=utf8;

CREATE TABLE `curated_feed_topics` (
  `topic_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `status` enum('live','off') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'live',
  `time_added` int(11) DEFAULT '0',
  `time_updated` int(11) DEFAULT '0',
  PRIMARY KEY (`topic_id`),
  UNIQUE KEY `name_idx` (`name`),
  KEY `status_idx` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8;

CREATE TABLE `curated_feed_queued_items` (
  `queued_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `feed_id` int(10) unsigned NOT NULL DEFAULT '0',
  `resolved_id` int(10) unsigned NOT NULL,
  `prospect_id` int(10) unsigned NOT NULL DEFAULT '0',
  `status` enum('ready','used','removed','expired') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'ready',
  `curator` varchar(50) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `relevance_length` enum('day','week','forever') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'week',
  `topic_id` int(10) unsigned NOT NULL DEFAULT '0',
  `weight` int(10) unsigned NOT NULL DEFAULT '1',
  `time_added` int(11) DEFAULT '0',
  `time_updated` int(11) DEFAULT '0',
  PRIMARY KEY (`queued_id`),
  UNIQUE KEY `resolved_idx` (`feed_id`,`resolved_id`),
  UNIQUE KEY `prospect_idx` (`prospect_id`),
  KEY `status_weight_idx` (`feed_id`,`status`,`weight`),
  KEY `status_rel_idx` (`feed_id`,`status`,`relevance_length`),
  KEY `status_idx` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=130371 DEFAULT CHARSET=utf8;

CREATE TABLE `curated_feed_items` (
  `curated_rec_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `feed_id` int(10) unsigned NOT NULL DEFAULT '0',
  `resolved_id` int(10) unsigned NOT NULL,
  `prospect_id` int(10) unsigned NOT NULL DEFAULT '0',
  `queued_id` int(10) unsigned NOT NULL DEFAULT '0',
  `status` enum('live','removed','spoc') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'live',
  `time_live` int(11) DEFAULT '0',
  `time_added` int(11) DEFAULT '0',
  `time_updated` int(11) DEFAULT '0',
  PRIMARY KEY (`curated_rec_id`),
  UNIQUE KEY `resolved_idx` (`feed_id`,`resolved_id`),
  UNIQUE KEY `queued_item_idx` (`queued_id`),
  KEY `status_time_idx` (`feed_id`,`status`,`time_live`)
) ENGINE=InnoDB AUTO_INCREMENT=121005 DEFAULT CHARSET=utf8;

CREATE TABLE `curated_feed_items_deleted` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `curated_rec_id` int(10) unsigned NOT NULL,
  `feed_id` int(10) unsigned NOT NULL DEFAULT '0',
  `resolved_id` int(10) unsigned NOT NULL,
  `prospect_id` int(10) unsigned NOT NULL DEFAULT '0',
  `queued_id` int(10) unsigned NOT NULL DEFAULT '0',
  `status` enum('live','removed','spoc') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'live',
  `time_live` int(11) DEFAULT '0',
  `time_added` int(11) DEFAULT '0',
  `time_updated` int(11) DEFAULT '0',
  `deleted_user_id` int(11) NOT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `status_time_idx` (`feed_id`,`status`,`time_live`)
) ENGINE=InnoDB AUTO_INCREMENT=9347 DEFAULT CHARSET=utf8;

CREATE TABLE `tile_source` (
  `tile_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `source_id` int(10) unsigned NOT NULL DEFAULT '0',
  `type` enum('curated','spoc') CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT 'curated',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tile_id`),
  UNIQUE KEY `resolved_idx` (`type`,`source_id`)
) ENGINE=InnoDB AUTO_INCREMENT=123359 DEFAULT CHARSET=utf8;

CREATE TABLE `syndicated_articles` (
  `resolved_id` int(10) unsigned NOT NULL DEFAULT '0',
  `original_resolved_id` int(10) unsigned NOT NULL DEFAULT '0',
  `author_user_id` int(10) unsigned NOT NULL,
  `date_published` datetime DEFAULT NULL,
  `status` tinyint(3) unsigned NOT NULL,
  `hide_images` tinyint(1) unsigned DEFAULT NULL,
  `force_domain_id` int(11) DEFAULT NULL,
  `syndicated_resolved_id` int(10) unsigned DEFAULT NULL,
  `show_ads` tinyint(1) unsigned DEFAULT '1',
  `publisher_url` mediumtext COLLATE utf8_unicode_ci NOT NULL,
  `author_names` mediumtext COLLATE utf8_unicode_ci,
  `expires_at` datetime DEFAULT NULL,
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `published_at` timestamp NULL DEFAULT NULL,
  `locale_language` varchar(3) COLLATE utf8_unicode_ci DEFAULT NULL,
  `locale_country` int(4) DEFAULT NULL,
  `title` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `excerpt` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `domain_id` int(10) unsigned NOT NULL,
  `publisher_id` int(10) unsigned NOT NULL,
  `syndicated_article_content_id` int(10) DEFAULT NULL,
  `slug` varchar(150) COLLATE utf8_unicode_ci DEFAULT NULL,
  `main_image` text COLLATE utf8_unicode_ci,
  `iab_top_category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `iab_sub_category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `curation_category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_author_user_id` (`author_user_id`),
  KEY `idx_original_resolved_id` (`original_resolved_id`),
  KEY `slug_idx` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=7614 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


CREATE DATABASE IF NOT EXISTS `readitla_b`;
USE `readitla_b`;

CREATE TABLE `domains` (
  `domain_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `domain` varchar(75) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `top_domain_id` int(10) unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`domain_id`),
  KEY `domain` (`domain`),
  KEY `top_domain_id` (`top_domain_id`,`domain_id`),
  KEY `updated_at` (`updated_at`),
  KEY `domains_domain_index` (`domain`)
) ENGINE=InnoDB AUTO_INCREMENT=63154779 DEFAULT CHARSET=latin1;