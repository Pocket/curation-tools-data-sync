import { handlerFn } from './index';
import { CuratedItemRecord } from './dynamodb/types';
import { getByCuratedRecId, truncateDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';

describe('test placeholder', () => {
  it('when event type is dynamo, insert record', async () => {
    await handlerFn('dynamo');
    const res: CuratedItemRecord = await getByCuratedRecId(dbClient, 10);
    await truncateDb(dbClient);

    console.log(res);
    expect(res).not.toBeUndefined();
    expect(res?.curatedRecId).toEqual(10);
    expect(res?.approvedItemExternalId).toEqual('random-approved-guid-10');
    expect(res?.scheduledItemExternalId).toEqual('random-scheduled-guid-10');
    expect(res?.scheduledSurfaceGuid).toEqual('NEW_TAB_EN_US');
  });
});
