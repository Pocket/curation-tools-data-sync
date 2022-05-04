## `load-queued-items.ts`
The `load-queued-items.ts` scripts facilitates draining the `curated_queued_items` table for scheduled items that are
in the `ready` state for a given `feed_id`(en-US, de-DE, etc).

## Why
After migrating all curation data from the old system, the curated feed items queue (essentially scheduled
items) needs to be drained for the various feeds for the firefox new tab. This must be done before curators can move 
to the new system for curation for the given feed. Moving the items in the queue with their respective time to live 
(`time_live`) ensures that data is not lost and queue/scheduled items are available for the new tab at the appropriate 
times after the transition.

## How it works
Items that show up on the new tab are first added into a queue, this queue is backed by the `curated_queued_items`
table. A [cron job](https://github.com/Pocket/ansible-playbooks/blob/master/templates/etc/cron.d/Cron-app.crontab.j2#L71)
runs a [python script](https://github.com/Pocket/Web/blob/main/processes/curation/add_feed_items.py) that takes a queued
item in the `ready` state and inserts it into the `curated_feed_items` table every hour on the `45th` minute.

This script replicates the logic in the [web repo python script](https://github.com/Pocket/Web/blob/main/processes/curation/add_feed_items.py)
and loops over it until there are no more items left in the `curated_queued_items` table.

## How to run
**IMPORTANT**

This script **MUST** be run after the hour of the last scheduled run and before the next scheduled run of the
[cron job](https://github.com/Pocket/ansible-playbooks/blob/master/templates/etc/cron.d/Cron-app.crontab.j2#L71).
For example, if the last job ran at 10:45am, wait for 11am to run the script and make sure to run it before 11:45am
with enough buffer to ensure the queue is drained for the given feed ID before the next scheduled run of the cron job.

### Steps:
 - Set up the database credentials by exporting the following env variables.
   - DB_HOST - `export DB_HOST=<readitla_ril-tmp_host>`
   - DB_USER - `export DB_USER=<readitla_ril-tmp_user>`
   - DB_PASSWORD - `export DB_PASSWORD=<readitla_ril-tmp_password>`
 - `cd bin`
 - `npm run load <feed_id>`
 - Note down the time we ran this script, we will use it in case we need to rollback

## Rollback `rollback-queued-items.ts`
## What is this?
This is a script that reverts the `curated_feed_items`, `curated_feed_queued_items` and `tile_source` tables to the 
state before `load-queued-items.ts` modified the records.

## How to run
- Get the time the `load-queded-items.ts` script was run as the `time_live`
- Set up the database credentials by exporting the following env variables.
   - DB_HOST - `export DB_HOST=<readitla_ril-tmp_host>`
   - DB_USER - `export DB_USER=<readitla_ril-tmp_user>`
   - DB_PASSWORD - `export DB_PASSWORD=<readitla_ril-tmp_password>`
- `cd bin`
- `npm run rollback <feed_id> <time_live>`

## Test SQL Scripts
- Get the queued IDs and the curated rec IDs for the items for a given feed and time_live
```SQL
SELECT queued_id, curated_rec_id FROM curated_feed_items WHERE feed_id = :feed_id AND time_live >= :time_live
```
- Check `tile_source` table to ensure that feed_item records have been added (migration) or delete (rollback)
```SQL
SELECT tile_id FROM tile_source where source_id in (SELECT curated_rec_id FROM curated_feed_items WHERE feed_id = :feed_id AND time_live >= :time_live);
```
- Get the count of all queued_items that has been moved to the `curated_feed_items` table
```SQL
SELECT
	count(queued_id)
FROM
	curated_feed_queued_items
where
	queued_id in (
	SELECT
		queued_id
	FROM
		curated_feed_items
	WHERE
		feed_id = :feed_id
		AND time_live >= :time_live)
AND
	status = 'used';
```