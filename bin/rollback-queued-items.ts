#! /usr/bin/env ts-node

// 1. Get all curated feed item IDs after time_live >= timestamp and matching feed_id
// 2. Update the status curated_feed_queued_items for the IDs from 1 to "ready" from "used"
// 3. Delete the IDs from the tile_source table
// 4. Delete the IDs from curated_feed_items table

import { Knex } from 'knex';
import { dbClient } from './db';

async function getCuratedItemsAfterDate(feedId: number, timeLive: number) {
  return dbClient('curated_feed_items')
    .select('queued_id', 'curated_rec_id')
    .where('time_live', '>=', timeLive)
    .where('feed_id', '=', feedId);
}

async function rollbackQueuedItems(queuedIds: number[], trx: Knex.Transaction) {
  await dbClient('curated_feed_queued_items')
    .update({
      status: 'ready',
      time_updated: dbClient.raw('time_added'),
    })
    .where('status', '=', 'used')
    .whereIn('queued_id', queuedIds)
    .transacting(trx);
}

async function rollbackTileSource(
  curatedRecIds: number[],
  trx: Knex.Transaction,
) {
  await dbClient('tile_source')
    .delete()
    .whereIn('source_id', curatedRecIds)
    .transacting(trx);
}

async function rollbackCuratedItems(
  curatedRecIds: number[],
  trx: Knex.Transaction,
) {
  return trx('curated_feed_items')
    .delete()
    .whereIn('curated_rec_id', curatedRecIds);
}

async function rollback() {
  const feedId: number = process.argv[2] as unknown as number;
  const timeLive: number = process.argv[3] as unknown as number;

  const curatedItems = await getCuratedItemsAfterDate(feedId, timeLive);
  const queuedIds: number[] = [];
  const curatedRecIds: number[] = [];

  for (const curatedItem of curatedItems) {
    queuedIds.push(curatedItem['queued_id']);
    curatedRecIds.push(curatedItem['curated_rec_id']);
  }

  return await dbClient.transaction(async (trx) => {
    await rollbackQueuedItems(queuedIds, trx);
    await rollbackTileSource(curatedRecIds, trx);
    await rollbackCuratedItems(curatedRecIds, trx);

    return { feedId, timeLive, curatedRecIds, queuedIds };
  });
}

rollback()
  .then((res) => {
    console.log(
      `Successfully rollback feed ID: ${res.feedId} after time_live: ${res.timeLive}`,
    );
    console.log(`Number of items affected back: ${res.curatedRecIds.length}`);
    console.log('Curated Rec IDs: ', JSON.stringify(res.curatedRecIds));
    console.log('Queued IDs: ', JSON.stringify(res.curatedRecIds));
    console.log('Done');
    process.exit();
  })
  .catch((e) => console.log(e));
