#! /usr/bin/env ts-node

/**
 * Usage: npm run load <feed_id>
 */

import knex from 'knex';

const connection = {
  host: process.env.DB_HOST || '<host>',
  user: process.env.DB_USER || '<user>',
  password: process.env.DB_PASSWORD || '<password>',
  port: 3306,
  database: 'readitla_ril-tmp',
  charset: 'utf8mb4',
};

const dbClient = knex({
  client: 'mysql',
  connection,
  pool: {
    /**
     * Explicitly set the session timezone. We don't want to take any chances with this
     */
    afterCreate: (connection, callback) => {
      connection.query(`SET time_zone = 'US/Central';`, (err) => {
        callback(err, connection);
      });
    },
  },
});

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

async function insertIntoCuratedFeedItem(queuedItem, timeLive) {
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
    .ignore();

  return rows[0] || undefined;
}

async function updateQueuedItem(queuedId) {
  await dbClient('curated_feed_queued_items')
    .update({
      status: 'used',
      time_updated: Math.floor(new Date().getTime() / 1000),
    })
    .where('queued_id', '=', queuedId);
}

async function insertTileSource(curatedRecId) {
  await dbClient('tile_source')
    .insert({
      source_id: curatedRecId,
      type: 'curated',
    })
    .onConflict()
    .ignore();
}

async function moveQueuedItems(feedId, baseTime) {
  console.log('Moving feed ID: ' + feedId);

  let queuedItem = await getNextQueuedItem(feedId);

  let i = 1;
  while (queuedItem) {
    const curatedRecId = await insertIntoCuratedFeedItem(
      queuedItem,
      i * 3600 + baseTime
    );
    await updateQueuedItem(queuedItem['queued_id']);
    await insertTileSource(curatedRecId);
    console.log(JSON.stringify(queuedItem));
    queuedItem = await getNextQueuedItem(feedId);
    i++;
  }

  console.log('Done with feed ID: ' + feedId + '\n');
}

async function load() {
  const feedId = process.argv.splice(2)[0];
  await moveQueuedItems(
    feedId,
    // Starting from the next hour
    Math.ceil(new Date().getTime() / 1000 / 3600) * 3600
  );
}

load()
  .then(() => {
    console.log('It is done!');
    process.exit();
  })
  .catch((e) => console.log(e));
