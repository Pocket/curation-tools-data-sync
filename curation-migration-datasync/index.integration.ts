import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import * as SecretManager from '../curation-migration-datasync/secretManager';
import * as EventConsumer from '../curation-migration-datasync/eventConsumer';
import sinon from 'sinon';
import { getDbCredentials } from '../curation-migration-datasync/secretManager';
import { writeClient } from './dynamodb/dbClient';
import { AddScheduledItemPayload, EventDetailType } from './types';
import { handlerFn } from './index';
import nock from 'nock';
import config from './config';
import { Knex } from 'knex';
import { convertDateToTimestamp } from './eventConsumer';
import {
  getByScheduledItemExternalId,
  insertCuratedItem,
} from './dynamodb/curatedItemIdMapper';
import { CuratedItemService } from './database/curatedItemService';

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
  let testEventBody: AddScheduledItemPayload;
  let testEvent;

  beforeEach(async () => {
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

    await truncateDynamoDb(dbClient);
    await db('curated_feed_prospects').truncate();
    await db('curated_feed_items').truncate();
    await db('curated_feed_queued_items').truncate();

    testEventBody = {
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

    testEvent = {
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

    nockParser(testEventBody);

    //populating the database
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
        top_domain_id: 100,
      },
      {
        domain_id: 456,
        domain: 'nytimes.com',
        top_domain_id: 200,
      },
    ].map((row) => {
      return {
        domain_id: row.domain_id,
        domain: row.domain,
        top_domain_id: row.top_domain_id,
      };
    });
    await db('readitla_b.domains').insert(inputDomainData);

    await db('syndicated_articles').truncate();
    await db('syndicated_articles').insert({
      resolved_id: 0,
      original_resolveD_id: 0,
      author_user_id: 1,
      status: 1,
      hide_images: 0,
      publisher_url: 'nytimes.com',
      domain_id: 456,
      publisher_id: 1,
      slug: 'the-most-important-scientific-problems-have-yet-to-be-solved',
    });
  });

  afterEach(async () => {
    await truncateDynamoDb(dbClient);
    sinon.restore();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('adds non-syndicated articles', async () => {
    await handlerFn(testEvent);
    await assertTables(testEventBody, db, 100);
  });

  it('adds syndicated articles with domainId from syndicated_articles table', async () => {
    testEventBody.isSyndicated = true;
    testEventBody.url =
      'https://getpocket.com/explore/item/the-most-important-scientific-problems-have-yet-to-be-solved?utm_source=pocket-newtab';
    testEvent.detail = testEventBody;
    nockParser(testEventBody);

    await handlerFn(testEvent);
    await assertTables(testEventBody, db, 200);
  });

  it('should not call dynamo db write when the sql transaction fails', async () => {
    let curatedItemService = new CuratedItemService(db);
    sinon.stub(curatedItemService, 'insertTileSource').throws('sql error');
    const dymamoDbSpy = sinon.spy(EventConsumer, 'insertAddedScheduledItem');

    await handlerFn(testEvent);
    expect(dymamoDbSpy.callCount).toEqual(0);
  });

  it('should rollback transaction if one of the database inserts fails', async () => {
    let curatedItemService = new CuratedItemService(db);
    sinon.stub(curatedItemService, 'insertTileSource').throws('sql error');

    await handlerFn(testEvent);
    const curatedItem = await db('curated_feed_items').select();
    const prospectItem = await db('curated_feed_prospects').select();
    const queuedItem = await db('curated_feed_queued_items').select();

    expect(curatedItem.length).toEqual(0);
    expect(prospectItem.length).toEqual(0);
    expect(queuedItem.length).toEqual(0);
  });
});

async function assertTables(
  testEventBody: AddScheduledItemPayload,
  db: Knex,
  topDomainId: number
) {
  let curatedItemRecord = await getByScheduledItemExternalId(
    dbClient,
    'random_scheduled_guid_1'
  );
  expect(curatedItemRecord[0].approvedItemExternalId).toEqual(
    testEventBody.approvedItemExternalId
  );
  expect(curatedItemRecord[0].scheduledSurfaceGuid).toEqual(
    testEventBody.scheduledSurfaceGuid
  );

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
  expect(curatedItem.resolved_id).toEqual(12345);
  expect(curatedItem.status).toEqual('live');
  expect(curatedItem.time_added).toEqual(testEventBody.createdAt);
  expect(curatedItem.time_updated).toEqual(testEventBody.updatedAt);

  const queuedItems = await db('curated_feed_queued_items')
    .select()
    .where({
      queued_id: curatedItem.queued_id,
    })
    .first();

  expect(queuedItems.feed_id).toEqual(1);
  expect(queuedItems.resolved_id).toEqual(12345);
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
  expect(prospectItem.resolved_id).toEqual(12345);
  expect(prospectItem.type).toBeNull();
  expect(prospectItem.curator).toEqual('sri');
  expect(prospectItem.status).toEqual('ready');
  expect(prospectItem.top_domain_id).toEqual(topDomainId);
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

function nockParser(testEventBody) {
  const parserData = { resolved_id: '12345', item: { domain_id: '123' } };
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
}
