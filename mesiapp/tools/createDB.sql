CREATE TABLE `images`(
    `id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    `uploadtime` TEXT,
    `submitter` TEXT,
    `imagepath` Text,
    `thumbpath` Text,
    `latitude` REAL,
    `longitude` REAL
);