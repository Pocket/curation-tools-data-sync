import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import {
  getByScheduledItemExternalId,
  insertCuratedItem,
} from './dynamodb/curatedItemIdMapper';
import * as SecretManager from '../curation-migration-datasync/secretManager';
import sinon from 'sinon';
import { getDbCredentials } from '../curation-migration-datasync/secretManager';
import { writeClient } from './dbClient';
import { AddScheduledItemPayload, EventDetailType } from './types';
import { handlerFn } from './index';
import nock from 'nock';
import config from './config';
import { Knex } from 'knex';
import { convertDateToTimestamp } from './eventConsumer';

describe('event consumption integration test', function () {
  const timestamp1 = Math.round(new Date('2020-10-10').getTime() / 1000);
  const timestamp2 = Math.round(new Date('2021-10-10').getTime() / 1000);

  const curatedItemRecords: CuratedItemRecord[] = [
    {
      curatedRecId: 2,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_US,
      scheduledItemExternalId: 'random_scheduled_guid_2',
      approvedItemExternalId: 'random_approved_guid_2',
      lastUpdatedAt: timestamp1,
    },
    {
      curatedRecId: 3,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_US,
      scheduledItemExternalId: 'random_scheduled_guid_3',
      approvedItemExternalId: 'random_approved_guid_3',
      lastUpdatedAt: timestamp1,
    },
    {
      curatedRecId: 4,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
      scheduledItemExternalId: 'random_scheduled_guid_4',
      approvedItemExternalId: 'random_approved_guid_4',
      lastUpdatedAt: timestamp2,
    },
  ];

  let db;

  beforeEach(async () => {
    await truncateDynamoDb(dbClient);
    sinon.stub(SecretManager, 'getDbCredentials').resolves({
      readHost: 'localhost',
      readUsername: 'root',
      readPassword: '',
      writeHost: 'localhost',
      writeUsername: 'root',
      writePassword: '',
      port: '3310',
    });
    db = await writeClient();

    const insertRecord = curatedItemRecords.map(async (item) => {
      await insertCuratedItem(dbClient, item);
    });
    await Promise.all(insertRecord);

    await db('curated_feed_topics').truncate();
    const inputTopicData = [
      { topic_id: 1, name: 'Business', status: 'live' },
      { topic_id: 2, name: 'Entertainment', status: 'live' },
      { topic_id: 3, name: 'Health & Fitness', status: 'live' },
      { topic_id: 4, name: 'Self Improvement', status: 'live' },
    ].map((row) => {
      return {
        topic_id: row.topic_id,
        name: row.name,
        status: row.status,
      };
    });
    await db('curated_feed_topics').insert(inputTopicData);

    await db('readitla_b.domains').truncate();
    const inputDomainData = [
      {
        domain_id: 123,
        domain: 'https://stackoverflow.blog',
        top_domain_id: 123,
      },
    ].map((row) => {
      return {
        domain_id: row.domain_id,
        domain: row.domain,
        top_domain_id: row.top_domain_id,
      };
    });
    await db('readitla_b.domains').insert(inputDomainData);
  });

  afterEach(async () => {
    await truncateDynamoDb(dbClient);
    await db.destroy();
    sinon.restore();
    jest.clearAllMocks();
  });

  let testEventBody: AddScheduledItemPayload = {
    eventType: EventDetailType.ADD_SCHEDULED_ITEM,
    scheduledItemExternalId: 'random_scheduled_guid_1',
    approvedItemExternalId: 'random_approved_guid_1',
    url: 'https://stackoverflow.blog/',
    title: 'Sync the new tool with legacy database',
    excerpt: 'will be deprecated soon',
    language: 'EN',
    publisher: 'Pocket blog',
    imageUrl: 'https://some-s3-url.com',
    topic: 'SELF_IMPROVEMENT',
    isSyndicated: false,
    createdAt: 1648593897,
    createdBy: 'ad|Mozilla-LDAP|sri',
    updatedAt: 1648593897,
    scheduledSurfaceGuid: 'NEW_TAB_EN_US',
    scheduledDate: '2022-03-25',
  };

  let testEvent = {
    version: '0',
    id: '8afc769f-bf1e-c87a-a0b6-1aa4c526831f',
    'detail-type': 'add-scheduled-item',
    source: 'curation-tools-datasync',
    account: '124567',
    time: '2022-03-29T22:55:16Z',
    region: 'us-east-1',
    resources: [],
    detail: {
      ...testEventBody,
    },
  };

  it('adds non-syndicated articles', async () => {
    const parserData = { resolved_id: '23434', item: { domain_id: '123' } };
    const params = new URLSearchParams({
      output: 'regular',
      getItem: '1',
      images: '0',
      url: testEventBody.url,
    });

    //todo: refactor code to call parser only once.
    nock(config.parserEndpoint)
      .get('/' + params.toString())
      .reply(200, parserData);
    nock(config.parserEndpoint)
      .get('/' + params.toString())
      .reply(200, parserData);

    await handlerFn(testEvent);
    await assertTables(testEventBody, db);
  });

  it('adds syndicated articles', () => {});

  it('throws error when scheduledItem externalId is not present', () => {});
});

async function assertTables(testEventBody: AddScheduledItemPayload, db: Knex) {
  let curatedItemRecord = await getByScheduledItemExternalId(
    dbClient,
    'random_scheduled_guid_1'
  );
  console.log(curatedItemRecord);
  const curatedItem = await db('curated_feed_items')
    .select()
    .where({
      curated_rec_id: curatedItemRecord[0].curatedRecId,
    })
    .first();

  expect(curatedItem.time_live).toEqual(
    convertDateToTimestamp(testEventBody.scheduledDate)
  );
  expect(curatedItem.feed_id).toEqual(1);
  expect(curatedItem.resolved_id).toEqual(23434);

  const queuedItems = await db('curated_feed_queued_items')
    .select()
    .where({
      queued_id: curatedItem.queued_id,
    })
    .first();

  expect(queuedItems.feed_id).toEqual(1);
  expect(queuedItems.resolved_id).toEqual(23434);
  expect(queuedItems.curator).toEqual('sri');
  expect(queuedItems.relevance_length).toEqual('week');
  expect(queuedItems.topic_id).toEqual(4);
  expect(queuedItems.time_added).toEqual(testEventBody.createdAt);
  expect(queuedItems.time_updated).toEqual(testEventBody.updatedAt);
  expect(queuedItems.prospect_id).toEqual(curatedItem.prospect_id);

  const prospectItem = await db('curated_feed_prospects')
    .select()
    .where({
      prospect_id: curatedItem.prospect_id,
    })
    .first();

  expect(prospectItem.feed_id).toEqual(1);
  expect(prospectItem.resolved_id).toEqual(23434);
  expect(prospectItem.type).toBeNull();
  expect(prospectItem.curator).toEqual('sri');
  expect(prospectItem.status).toEqual('ready');
  expect(prospectItem.top_domain_id).toEqual(123);
  expect(prospectItem.time_added).toEqual(testEventBody.createdAt);
  expect(prospectItem.time_updated).toEqual(testEventBody.updatedAt);
  expect(prospectItem.prospect_id).toEqual(curatedItem.prospect_id);
  expect(prospectItem.title).toEqual(testEventBody.title);
  expect(prospectItem.excerpt).toEqual(testEventBody.excerpt);
  expect(prospectItem.image_src).toEqual(testEventBody.imageUrl);

  const tileSource = await db('tile_source')
    .select()
    .where({
      source_id: curatedItemRecord[0].curatedRecId,
    })
    .first();

  expect(tileSource.tile_id).toBeGreaterThan(0);
}
