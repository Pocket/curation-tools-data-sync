#! /usr/bin/env ts-node

import { dbClient } from './db';
import { Knex } from 'knex';

/**
 * Usage: npm run load <feed_id>
 */

const GET_NEXT_QUEUED_ITEM =
  'SELECT\n' +
  '                  q.queued_id,\n' +
  '                  q.relevance_length,\n' +
  '                  q.weight,\n' +
  '                  q.feed_id,\n' +
  '                  q.prospect_id,\n' +
  '                  q.resolved_id,\n' +
  '                  CASE\n' +
  "                    WHEN q.relevance_length = 'day' THEN :dayWeight\n" +
  "                    WHEN q.relevance_length = 'week' THEN :weekWeight\n" +
  "                    WHEN q.relevance_length = 'forever' THEN :foreverWeight\n" +
  '                  END AS time_weight,\n' +
  '                  q.time_added\n' +
  '                FROM `readitla_ril-tmp`.curated_feed_queued_items q\n' +
  '                WHERE q.feed_id = :feedId\n' +
  "                AND q.status = 'ready'\n" +
  '                ORDER BY q.weight DESC, time_weight DESC, q.time_added ASC\n' +
  '                LIMIT 1;';

async function getNextQueuedItem(feedId) {
  const dayWeight = getRandomInt(1, 101);
  const weekWeight = getRandomInt(1, 91);
  const foreverWeight = getRandomInt(1, 81);
  return dbClient
    .raw(GET_NEXT_QUEUED_ITEM, {
      dayWeight,
      weekWeight,
      foreverWeight,
      feedId,
    })
    .then((rows) => {
      if (rows.length) return rows[0][0];
      return undefined;
    });
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

async function insertIntoCuratedFeedItem(
  queuedItem,
  timeLive,
  trx: Knex.Transaction,
) {
  const now = Math.floor(new Date().getTime() / 1000);

  const rows = await dbClient('curated_feed_items')
    .insert({
      feed_id: queuedItem['feed_id'],
      prospect_id: queuedItem['prospect_id'],
      resolved_id: queuedItem['resolved_id'],
      queued_id: queuedItem['queued_id'],
      time_live: timeLive,
      time_added: now,
      time_updated: now,
    })
    .onConflict()
    .ignore()
    .transacting(trx);

  return rows[0] || undefined;
}

async function updateQueuedItem(queuedId, trx: Knex.Transaction) {
  await dbClient('curated_feed_queued_items')
    .update({
      status: 'used',
      time_updated: Math.floor(new Date().getTime() / 1000),
    })
    .where('queued_id', '=', queuedId)
    .transacting(trx);
}

async function insertTileSource(curatedRecId, trx: Knex.Transaction) {
  await dbClient('tile_source')
    .insert({
      source_id: curatedRecId,
      type: 'curated',
    })
    .onConflict()
    .ignore()
    .transacting(trx);
}

async function moveQueuedItems(feedId, baseTime) {
  console.log('Moving feed ID: ' + feedId);

  let queuedItem = await getNextQueuedItem(feedId);

  let i = 1;
  while (queuedItem) {
    const trx = await dbClient.transaction();
    try {
      const curatedRecId = await insertIntoCuratedFeedItem(
        queuedItem,
        i * 3600 + baseTime,
        trx,
      );
      await updateQueuedItem(queuedItem['queued_id'], trx);
      await insertTileSource(curatedRecId, trx);
      await trx.commit();
      console.log(JSON.stringify(queuedItem));
    } catch (e) {
      await trx.rollback();
      console.log(
        `Number of items emptied from the queue before error occurred: ${
          i - 1
        }`,
      );
      console.log(`Failed at queued item ID: ${queuedItem['queued_id']}`);
      console.log(`Failed for the time_live: ${i * 3600 + baseTime}`);
      throw e;
    }
    queuedItem = await getNextQueuedItem(feedId);
    i++;
  }

  console.log('Done with feed ID: ' + feedId + '\n');

  return i - 1;
}

async function load() {
  const feedId = process.argv.splice(2)[0];
  const startTime = Math.ceil(new Date().getTime() / 1000 / 3600) * 3600;
  const count = await moveQueuedItems(
    feedId,
    // Starting from the next hour
    startTime,
  );

  return { count, startTime };
}

load()
  .then((res) => {
    console.log(`First queued item for feed scheduled for ${res.startTime}`);
    console.log(`Number of items emptied from the queue: ${res.count}`);
    console.log('It is done!');
    process.exit();
  })
  .catch((e) => console.log(e));
