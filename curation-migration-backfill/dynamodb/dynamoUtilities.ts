import * as Sentry from '@sentry/serverless';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  ScanCommand,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';
import { CuratedItemRecord, DynamoItem } from './types';

/***
 * Requirements:
 * 1. get by curatedRecId
 * 2. get by externalIdScheduledItems
 * 3. add by curatedRecId (/)
 * 4. delete by curatedRecId
 * 5. truncate table. (/)
 */

/**
 * generate insert command parameter from curatedItemRecord
 */
export const generateInsertParameters = (
  curatedItemRecord: CuratedItemRecord
): PutCommandInput => {
  return {
    TableName: config.aws.dynamoDB.curationMigrationTable,
    Item: {
      curated_rec_id: curatedItemRecord.curatedRecId,
      scheduledSurfaceGuid: curatedItemRecord.scheduledSurfaceGuid,
      scheduledItemExternalId: curatedItemRecord.scheduledItemExternalId,
      approvedItemExternalId: curatedItemRecord.approvedItemExternalId,
      lastUpdated: curatedItemRecord.lastUpdated,
    },
  };
};

/**
 * inserts a curatedItemRecord to the dynamoDb
 *
 * @param curatedItemRecord
 */
export const insertCuratedItem = async (
  dbClient: DynamoDBDocumentClient,
  curatedItemRecord: CuratedItemRecord
): Promise<void> => {
  // convert the prospect to dynamo insert format
  const params = generateInsertParameters(curatedItemRecord);

  await dbClient.send(new PutCommand(params));
};

/**
 * deletes a curatedItemRecord to the dynamoDb
 *
 * @param curatedItemRecord
 */
export const deleteItem = async (
  dbClient: DynamoDBDocumentClient,
  curatedRecId: number
): Promise<void> => {
  await dbClient.send(
    new DeleteCommand({
      TableName: config.aws.dynamoDB.curationMigrationTable,
      Key: {
        curated_rec_id: curatedRecId,
      },
    })
  );
};

/**
 * retrieves item record by curated_rec_id
 * @param curatedRecId curated feeds itemId in the readitla-tmp database
 * @returns CuratedItemRecord matching curated item record
 */
export const getByCuratedRecId = async (
  dbClient,
  curatedRecId: number
): Promise<DynamoItem> => {
  const input: GetCommandInput = {
    TableName: config.aws.dynamoDB.curationMigrationTable,
    Key: {
      curated_rec_id: curatedRecId,
    },
  };

  const res = await dbClient.send(new GetCommand(input));
  return res.Item;
};

/**
 * test helper method for integration tests
 *
 * note - this will only delete a max of 1MB of data, but we should never
 * hit that in our integration tests
 */
export const truncateDb = async (
  dbClient: DynamoDBDocumentClient
): Promise<void> => {
  const rows = await scanAllRows(dbClient);

  rows.Items?.forEach(async function (element, _) {
    await dbClient.send(
      new DeleteCommand({
        TableName: config.aws.dynamoDB.curationMigrationTable,
        Key: {
          curated_rec_id: element,
        },
      })
    );
  });
};

/**
 * test helper method for integration tests. essentially a way to retrieve all
 * rows in the database - for counting or truncating.
 *
 * @returns ScanCommandOutput - object containing, among other things, an
 * array of Items
 */
export const scanAllRows = async (
  dbClient: DynamoDBDocumentClient
): Promise<ScanCommandOutput> => {
  return await dbClient.send(
    new ScanCommand({
      TableName: config.aws.dynamoDB.curationMigrationTable,
      AttributesToGet: [config.aws.dynamoDB.curatedRecIdHashKey],
    })
  );
};
