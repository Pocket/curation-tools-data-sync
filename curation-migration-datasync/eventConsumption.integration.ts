import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import { insertCuratedItem } from './dynamodb/curatedItemIdMapper';
import { writeClient } from './dbClient';

describe('event consumption integration test', function () {
  const timestamp1 = Math.round(new Date('2020-10-10').getTime() / 1000);
  const timestamp2 = Math.round(new Date('2021-10-10').getTime() / 1000);

  const curatedItemRecords: CuratedItemRecord[] = [
    {
      curatedRecId: 1,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
      scheduledItemExternalId: 'random-scheduled-guid-1',
      approvedItemExternalId: 'random-approved-guid-1',
      lastUpdatedAt: Math.round(new Date().getTime() / 1000),
    },
    {
      curatedRecId: 2,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_US,
      scheduledItemExternalId: 'random-scheduled-guid-2',
      approvedItemExternalId: 'random-approved-guid-2',
      lastUpdatedAt: timestamp1,
    },
    {
      curatedRecId: 3,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_US,
      scheduledItemExternalId: 'random-scheduled-guid-3',
      approvedItemExternalId: 'random-approved-guid-3',
      lastUpdatedAt: timestamp1,
    },
    {
      curatedRecId: 4,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
      scheduledItemExternalId: 'random-scheduled-guid-4',
      approvedItemExternalId: 'random-approved-guid-4',
      lastUpdatedAt: timestamp2,
    },
  ];

  const db = writeClient();

  beforeAll(async () => {
    await truncateDynamoDb(dbClient);

    const insertRecord = curatedItemRecords.map(async (item) => {
      await insertCuratedItem(dbClient, item);
    });
    await Promise.all(insertRecord);

    await db('curated-feed-topics').truncate();
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
    await db('curated-feed-topics').insert(inputTopicData);
  });

  afterAll(async () => {
    await truncateDynamoDb(dbClient);
    await writeClient().destroy();
  });

  it('adds non-syndicated articles', () => {});

  it('adds syndicated articles', () => {});

  it('throws error when scheduledItem externalId is not present', () => {});
});
