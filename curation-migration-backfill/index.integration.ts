import { handlerFn } from './index';
import { CuratedItemRecord } from './dynamodb/types';
import { truncateDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import { ScheduledSurfaceGuid } from './types';
import { getByCuratedRecId } from './dynamodb/curatedItemIdMapper';

describe('test to read dynamoDb data from lambda code', () => {
  afterAll(async () => {
    await truncateDb(dbClient);
  });

  //todo: can be removed later when we remove the dynamo check in index.ts
  it('when event type is dynamo, insert record', async () => {
    await handlerFn('dynamo');
    const res: CuratedItemRecord = await getByCuratedRecId(dbClient, 10);

    expect(res).not.toBeUndefined();
    expect(res?.curatedRecId).toEqual(10);
    expect(res?.approvedItemExternalId).toEqual('random-approved-guid-10');
    expect(res?.scheduledItemExternalId).toEqual('random-scheduled-guid-10');
    expect(res?.scheduledSurfaceGuid).toEqual(
      ScheduledSurfaceGuid.NEW_TAB_EN_US
    );
  });
});
