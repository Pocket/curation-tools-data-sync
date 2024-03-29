import { CuratedItemRecord, ScheduledSurfaceGuid } from './types';
import { CuratedItemRecordModel } from './curatedItemRecordModel';
import { truncateDynamoDb } from './dynamoUtilities';
import { dbClient } from './dynamoDbClient';

describe('dynamodb read and write test', () => {
  const timestamp1 = Math.round(new Date('2020-10-10').getTime() / 1000);
  const timestamp2 = Math.round(new Date('2021-10-10').getTime() / 1000);
  const curatedItemModel = new CuratedItemRecordModel();

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
    {
      curatedRecId: 5,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_DE_DE,
      scheduledItemExternalId: 'random-scheduled-guid-5',
      approvedItemExternalId: 'random-approved-guid-4',
      lastUpdatedAt: timestamp1,
    },
  ];

  beforeEach(async () => {
    await truncateDynamoDb(dbClient);

    const insertRecord = curatedItemRecords.map(async (item) => {
      await curatedItemModel.upsert(item);
    });
    await Promise.all(insertRecord);
  });

  afterEach(async () => {
    await truncateDynamoDb(dbClient);
  });

  it('should add curatedItem and get by curatedRecId', async () => {
    const itemToBeAdded: CuratedItemRecord = {
      curatedRecId: 5,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_INTL,
      scheduledItemExternalId: 'random-scheduled-guid-5',
      approvedItemExternalId: 'random-approved-guid-5',
      lastUpdatedAt: timestamp2,
    };
    await curatedItemModel.upsert(itemToBeAdded);
    const res = await curatedItemModel.getByCuratedRecId(
      itemToBeAdded.curatedRecId,
    );

    expect(res).not.toBeUndefined();
    expect(res?.curatedRecId).toEqual(5);
    expect(res?.scheduledItemExternalId).toEqual('random-scheduled-guid-5');
    expect(res?.approvedItemExternalId).toEqual('random-approved-guid-5');
    expect(res?.lastUpdatedAt).toEqual(timestamp2);
    expect(res?.scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_INTL,
    );
  });

  it('should get curatedItems by scheduledSurfaceGuid', async () => {
    const res: CuratedItemRecord[] =
      await curatedItemModel.getByScheduledSurfaceGuid(
        ScheduledSurfaceGuid.NEW_TAB_EN_US,
      );

    expect(res).not.toBeUndefined();
    expect(res.length).toEqual(2);
    expect(res?.[0].curatedRecId).toEqual(2);
    expect(res?.[0].scheduledItemExternalId).toEqual('random-scheduled-guid-2');
    expect(res?.[0].approvedItemExternalId).toEqual('random-approved-guid-2');
    expect(res?.[0].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_US,
    );
    expect(res?.[0].lastUpdatedAt).toEqual(timestamp1);
    expect(res?.[1].curatedRecId).toEqual(3);
    expect(res?.[1].scheduledItemExternalId).toEqual('random-scheduled-guid-3');
    expect(res?.[1].approvedItemExternalId).toEqual('random-approved-guid-3');
    expect(res?.[1].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_US,
    );
    expect(res?.[1].lastUpdatedAt).toEqual(timestamp1);
  });

  it('should get curatedItem by scheduledItems external Id', async () => {
    const res = await curatedItemModel.getByScheduledItemExternalId(
      'random-scheduled-guid-4',
    );
    expect(res).not.toBeUndefined();
    expect(res).not.toBeNull();
    expect(res?.curatedRecId).toEqual(4);
    expect(res?.scheduledItemExternalId).toEqual('random-scheduled-guid-4');
    expect(res?.approvedItemExternalId).toEqual('random-approved-guid-4');
    expect(res?.scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_GB,
    );
    expect(res?.lastUpdatedAt).toEqual(timestamp2);
  });

  it('should get all curatedItemRecords matching with approvedItemexternalId', async () => {
    const res: CuratedItemRecord[] =
      await curatedItemModel.getByApprovedItemExternalId(
        'random-approved-guid-4',
      );
    expect(res).not.toBeUndefined();
    expect(res.length).toEqual(2);
    expect(res?.[0].curatedRecId).toEqual(5);
    expect(res?.[0].scheduledItemExternalId).toEqual('random-scheduled-guid-5');
    expect(res?.[0].approvedItemExternalId).toEqual('random-approved-guid-4');
    expect(res?.[0].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_DE_DE,
    );
    expect(res?.[0].lastUpdatedAt).toEqual(timestamp1);
    expect(res?.[1].curatedRecId).toEqual(4);
    expect(res?.[1].scheduledItemExternalId).toEqual('random-scheduled-guid-4');
    expect(res?.[1].approvedItemExternalId).toEqual('random-approved-guid-4');
    expect(res?.[1].scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_GB,
    );
    expect(res?.[1].lastUpdatedAt).toEqual(timestamp2);
  });

  it('should delete a single record from the dynamo db', async () => {
    await curatedItemModel.deleteByCuratedRecId(
      curatedItemRecords[3].curatedRecId,
    );

    const res = await curatedItemModel.getByCuratedRecId(
      curatedItemRecords[3].curatedRecId,
    );
    expect(res).toBeNull();
  });
  it('should return null if curatedRecId does not exist', async () => {
    const res = await curatedItemModel.getByCuratedRecId(999991111113234);
    expect(res).toBeNull();
  });
});
