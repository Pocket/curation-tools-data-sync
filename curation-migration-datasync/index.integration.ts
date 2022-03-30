import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import { insertCuratedItem } from './dynamodb/curatedItemIdMapper';
import * as SecretManager from '../curation-migration-datasync/secretManager';
import sinon from 'sinon';
import { getDbCredentials } from '../curation-migration-datasync/secretManager';
import { writeClient } from './dbClient';
import { AddScheduledItemPayload, EventDetailType } from './types';
import { handlerFn } from './index';
import nock from 'nock';
import config from './config';

describe('event consumption integration test', function () {
  const timestamp1 = Math.round(new Date('2020-10-10').getTime() / 1000);
  const timestamp2 = Math.round(new Date('2021-10-10').getTime() / 1000);

  const curatedItemRecords: CuratedItemRecord[] = [
    {
      curatedRecId: 1,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
      scheduledItemExternalId: 'random_scheduled_guid_1',
      approvedItemExternalId: 'random_approved_guid_1',
      lastUpdatedAt: Math.round(new Date().getTime() / 1000),
    },
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

    await handlerFn(testEvent);
  });

  it('adds syndicated articles', () => {});

  it('throws error when scheduledItem externalId is not present', () => {});
});
