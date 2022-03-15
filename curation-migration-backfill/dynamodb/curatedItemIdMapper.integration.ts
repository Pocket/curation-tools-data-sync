import { CuratedItemRecord } from './types';
import { ScheduledSurfaceGuid } from '../types';
import {
  deleteItemByCuratedRecId,
  getByCuratedRecId,
  getByScheduledItemExternalId,
  getByScheduledSurfaceGuid,
  insertCuratedItem,
} from './curatedItemIdMapper';
import { truncateDb } from './dynamoUtilities';
import { dbClient } from './dynamoDbClient';

describe('dynamodb read and write test', () => {
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

  beforeAll(async () => {
    await truncateDb(dbClient);

    const insertRecord = curatedItemRecords.map(async (item) => {
      await insertCuratedItem(dbClient, item);
    });
    await Promise.all(insertRecord);
  });

  afterAll(async () => {
    await truncateDb(dbClient);
  });

  it('should add curatedItem and get by curatedRecId', async () => {
    const itemToBeAdded: CuratedItemRecord = {
      curatedRecId: 5,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_INTL,
      scheduledItemExternalId: 'random-scheduled-guid-5',
      approvedItemExternalId: 'random-approved-guid-5',
      lastUpdatedAt: timestamp2,
    };
    await insertCuratedItem(dbClient, itemToBeAdded);
    const res: CuratedItemRecord = await getByCuratedRecId(
      dbClient,
      itemToBeAdded.curatedRecId
    );

    expect(res).not.toBeUndefined();
    expect(res?.curatedRecId).toEqual(5);
    expect(res?.scheduledItemExternalId).toEqual('random-scheduled-guid-5');
    expect(res?.approvedItemExternalId).toEqual('random-approved-guid-5');
    expect(res?.lastUpdatedAt).toEqual(timestamp2);
    expect(res?.scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_INTL
    );
  });

  it('should get curatedItems by scheduledSurfaceGuid', async () => {
    const res: CuratedItemRecord[] = await getByScheduledSurfaceGuid(
      dbClient,
      ScheduledSurfaceGuid.NEW_TAB_EN_US
    );

    expect(res).not.toBeUndefined();
    expect(res.length).toEqual(2);
    expect(res?.[0].curatedRecId).toEqual(2);
    expect(res?.[0].scheduledItemExternalId).toEqual('random-scheduled-guid-2');
    expect(res?.[0].approvedItemExternalId).toEqual('random-approved-guid-2');
    expect(res?.[0].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_US
    );
    expect(res?.[0].lastUpdatedAt).toEqual(timestamp1);
    expect(res?.[1].curatedRecId).toEqual(3);
    expect(res?.[1].scheduledItemExternalId).toEqual('random-scheduled-guid-3');
    expect(res?.[1].approvedItemExternalId).toEqual('random-approved-guid-3');
    expect(res?.[1].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_US
    );
    expect(res?.[1].lastUpdatedAt).toEqual(timestamp1);
  });

  it('should get curatedItem by scheduledItems external Id', async () => {
    const res: CuratedItemRecord[] = await getByScheduledItemExternalId(
      dbClient,
      'random-scheduled-guid-4'
    );
    expect(res).not.toBeUndefined();
    expect(res.length).toEqual(1);
    expect(res?.[0].curatedRecId).toEqual(4);
    expect(res?.[0].scheduledItemExternalId).toEqual('random-scheduled-guid-4');
    expect(res?.[0].approvedItemExternalId).toEqual('random-approved-guid-4');
    expect(res?.[0].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_GB
    );
    expect(res?.[0].lastUpdatedAt).toEqual(timestamp2);
  });

  it('should delete a single record from the dynamo db', async () => {
    await deleteItemByCuratedRecId(
      dbClient,
      curatedItemRecords[3].curatedRecId
    );

    const res: CuratedItemRecord = await getByCuratedRecId(
      dbClient,
      curatedItemRecords[3].curatedRecId
    );
    expect(res.curatedRecId).toBeUndefined();
  });
});
