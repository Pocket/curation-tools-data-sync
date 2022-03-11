import * as Sentry from '@sentry/serverless';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  ScanCommand,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';
import { CuratedItemRecord } from './types';
import { ScheduledSurfaceGuid } from '../types';
import { dbClient } from './dynamoDbClient';
import any = jasmine.any;

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
      curatedRecId: curatedItemRecord.curatedRecId,
      scheduledSurfaceGuid: curatedItemRecord.scheduledSurfaceGuid,
      scheduledItemExternalId: curatedItemRecord.scheduledItemExternalId,
      approvedItemExternalId: curatedItemRecord.approvedItemExternalId,
      lastUpdatedAt: curatedItemRecord.lastUpdatedAt,
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
export const deleteItemByCuratedRecId = async (
  dbClient: DynamoDBDocumentClient,
  curatedRecId: number
): Promise<void> => {
  await dbClient.send(
    new DeleteCommand({
      TableName: config.aws.dynamoDB.curationMigrationTable,
      Key: {
        curatedRecId: curatedRecId,
      },
    })
  );
};

/**
 * retrieves item record by curatedRecId
 * @param curatedRecId curated feeds itemId in the readitla-tmp database
 * @returns CuratedItemRecord matching curated item record
 */
export const getByCuratedRecId = async (
  dbClient,
  curatedRecId: number
): Promise<CuratedItemRecord> => {
  const input: GetCommandInput = {
    TableName: config.aws.dynamoDB.curationMigrationTable,
    Key: {
      curatedRecId: curatedRecId,
    },
  };

  const res = await dbClient.send(new GetCommand(input));

  return {
    curatedRecId: res.Item?.curatedRecId,
    scheduledSurfaceGuid: res.Item?.scheduledSurfaceGuid,
    scheduledItemExternalId: res.Item?.scheduledItemExternalId,
    approvedItemExternalId: res.Item?.approvedItemExternalId,
    lastUpdatedAt: res.Item?.lastUpdatedAt,
  };
};

/**
 * retrieves items by scheduledSurfaceGuid
 * @param scheduledSurfaceGuid
 * @returns CuratedItemRecord matching curated items
 */
export const getByScheduledSurfaceGuid = async (
  dbClient,
  scheduledSurfaceGuid: ScheduledSurfaceGuid
): Promise<CuratedItemRecord[]> => {
  const input: QueryCommandInput = {
    TableName: config.aws.dynamoDB.curationMigrationTable,
    IndexName: 'scheduledSurfaceGuid-GSI',
    KeyConditionExpression: 'scheduledSurfaceGuid = :scheduledSurfaceGuid',
    //todo: search by lastUpdatedAt
    ExpressionAttributeValues: {
      ':scheduledSurfaceGuid': scheduledSurfaceGuid.toString(),
    },
  };
  const res: QueryCommandOutput = await dbClient.send(new QueryCommand(input));

  // LastEvaluatedKey will only be present if there are multiple pages of
  // results from the query - which means we have more than 1MB of data for
  //we will have less than 1MB of data per feed.
  //todo: check if we need to implement pagination
  if (res.LastEvaluatedKey) {
    Sentry.captureMessage(
      `method 'getByScheduledSurfaceGuid' called with '${scheduledSurfaceGuid}'
       has multiple pages of results that we are not handling!`
    );
  }

  if (res.Items?.length) {
    return res.Items.map((item): CuratedItemRecord => {
      // force type safety
      return {
        curatedRecId: item.curatedRecId,
        scheduledSurfaceGuid: item.scheduledSurfaceGuid,
        scheduledItemExternalId: item.scheduledItemExternalId,
        approvedItemExternalId: item.approvedItemExternalId,
        lastUpdatedAt: item.lastUpdatedAt,
      };
    });
  } else {
    return [];
  }
};

/**
 * retrieves curatedItem by scheduledItemExternalId
 * @param scheduledItemExternalId externalId of the scheduled item from curatedCorpusApi
 * @returns CuratedItemRecord matching curated item record
 */
export const getByScheduledItemExternalId = async (
  dbClient,
  //todo: can be a enum as we are only getting 4 new tabs
  scheduledItemExternalId: string
): Promise<CuratedItemRecord[]> => {
  const input: QueryCommandInput = {
    TableName: config.aws.dynamoDB.curationMigrationTable,
    IndexName: 'scheduledItemExternalId-GSI',
    KeyConditionExpression:
      'scheduledItemExternalId = :scheduledItemExternalId',
    ExpressionAttributeValues: {
      ':scheduledItemExternalId': scheduledItemExternalId,
    },
  };
  const res: QueryCommandOutput = await dbClient.send(new QueryCommand(input));

  //this must always be false coz we are expecting only one item per record.
  //if this gets thrown, we need to investigate the bug
  if (res.LastEvaluatedKey) {
    Sentry.captureMessage(
      `method 'getByScheduledItemExternalId' called with '${scheduledItemExternalId}'
       has multiple pages of results that we are not handling!`
    );
  }

  if (res.Items?.length) {
    return res.Items.map((item): CuratedItemRecord => {
      // force type safety
      return {
        curatedRecId: item.curatedRecId,
        scheduledSurfaceGuid: item.scheduledSurfaceGuid,
        scheduledItemExternalId: item.scheduledItemExternalId,
        approvedItemExternalId: item.approvedItemExternalId,
        lastUpdatedAt: item.lastUpdatedAt,
      };
    });
  } else {
    return [];
  }
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

  let items = rows.Items as any;
  for (let r of items) {
    await dbClient.send(
      new DeleteCommand({
        TableName: config.aws.dynamoDB.curationMigrationTable,
        Key: {
          curatedRecId: r.curatedRecId,
        },
      })
    );
  }

  const t = await scanAllRows(dbClient);
  console.log(t);
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
