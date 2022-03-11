import { CuratedItemRecord } from './types';
import {
  getByCuratedRecId,
  insertCuratedItem,
  truncateDb,
} from './dynamoUtilities';
import { dbClient } from './dynamoDbClient';

describe('dynamodb read and write test', () => {
  let curatedItemRecord: CuratedItemRecord;

  beforeEach(() => {
    curatedItemRecord = {
      curatedRecId: 1,
      scheduledSurfaceGuid: 'NEW_TAB_EN_US',
      scheduledItemExternalId: 'guid-scheduled-item-external-id',
      approvedItemExternalId: 'guid-approved-item-external-id',
      lastUpdated: Math.round(new Date().getTime() / 1000),
    };
  });

  afterEach(async () => {
    await truncateDb(dbClient);
  });

  it('should add curtedItem to the dynamo db', async () => {
    await insertCuratedItem(dbClient, curatedItemRecord);
    const res = await getByCuratedRecId(
      dbClient,
      curatedItemRecord.curatedRecId
    );

    console.log(res);
    expect(res).not.toBeUndefined();
  });

  it('should get curtedItem by curated_rec_id from the dynamo db', async () => {});

  it('should get curatedItem by scheduledItemExternalId from the dynamo db', async () => {});

  it('should get curatedItem by scheduledSurfaceGuid from the dynamo db', async () => {});
});
