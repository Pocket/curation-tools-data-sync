import { CuratedItemRecord, ScheduledSurfaceGuid } from './types';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';
import * as Sentry from '@sentry/serverless';
import { dbClient } from './dynamoDbClient';
import { ScheduledItemPayload } from '../types';

export class CuratedItemRecordModel {
  private client: DynamoDBDocumentClient;
  constructor(client?: DynamoDBDocumentClient) {
    this.client = client ?? dbClient;
  }

  /**
   * retrieves curatedItem by scheduledItemExternalId
   * @param scheduledItemExternalId externalId of the scheduled item from curatedCorpusApi
   * @returns CuratedItemRecord matching curated item record
   */
  public async getByScheduledItemExternalId(
    scheduledItemExternalId: string
  ): Promise<CuratedItemRecord | null> {
    const input: QueryCommandInput = {
      TableName: config.aws.dynamoDB.curationMigrationTable,
      IndexName: 'scheduledItemExternalId-GSI',
      KeyConditionExpression:
        'scheduledItemExternalId = :scheduledItemExternalId',
      ExpressionAttributeValues: {
        ':scheduledItemExternalId': scheduledItemExternalId,
      },
      Limit: 1,
    };
    const res: QueryCommandOutput = await this.client.send(
      new QueryCommand(input)
    );

    if (res.Items?.length) {
      const item = res.Items[0];
      return {
        curatedRecId: item.curatedRecId,
        scheduledSurfaceGuid: item.scheduledSurfaceGuid,
        scheduledItemExternalId: item.scheduledItemExternalId,
        approvedItemExternalId: item.approvedItemExternalId,
        lastUpdatedAt: item.lastUpdatedAt,
      };
    } else {
      return null;
    }
  }

  /**
   * retrieves list of curatedItem by approvedItemExternalId
   * Note: we have 1:N mapping of approvedItem externalId and curated_rec_id
   * @param approvedItemExternalId approvedItem's externalId
   */
  public async getByApprovedItemExternalId(
    approvedItemExternalId: string
  ): Promise<CuratedItemRecord[]> {
    const input: QueryCommandInput = {
      TableName: config.aws.dynamoDB.curationMigrationTable,
      IndexName: 'approvedItemExternalId-GSI',
      KeyConditionExpression:
        'approvedItemExternalId = :approvedItemExternalId',
      ExpressionAttributeValues: {
        ':approvedItemExternalId': approvedItemExternalId,
      },
    };
    const res: QueryCommandOutput = await this.client.send(
      new QueryCommand(input)
    );

    //this must always be false coz we are expecting only one item per record.
    //if this gets thrown, we need to investigate the bug
    if (res.LastEvaluatedKey) {
      Sentry.captureMessage(
        `method 'getByApprovedItemExternalId' called with '${approvedItemExternalId}'
       has multiple pages of results that we are not handling!`
      );
    }

    return res.Items as CuratedItemRecord[];
  }

  /**
   * retrieves items by scheduledSurfaceGuid
   * @param scheduledSurfaceGuid
   * @returns CuratedItemRecord matching curated items
   */
  public async getByScheduledSurfaceGuid(
    scheduledSurfaceGuid: ScheduledSurfaceGuid
  ): Promise<CuratedItemRecord[]> {
    const input: QueryCommandInput = {
      TableName: config.aws.dynamoDB.curationMigrationTable,
      IndexName: 'scheduledSurfaceGuid-GSI',
      KeyConditionExpression: 'scheduledSurfaceGuid = :scheduledSurfaceGuid',
      //todo: search by lastUpdatedAt
      ExpressionAttributeValues: {
        ':scheduledSurfaceGuid': scheduledSurfaceGuid.toString(),
      },
    };
    const res: QueryCommandOutput = await this.client.send(
      new QueryCommand(input)
    );

    // LastEvaluatedKey will only be present if there are multiple pages of
    // results from the query - which means we have more than 1MB of data for
    // we will have less than 1MB of data per feed.
    // Get more records using the LastEvaluatedKey if we expect more than 1MB of data.
    if (res.LastEvaluatedKey) {
      Sentry.captureMessage(
        `method 'getByScheduledSurfaceGuid' called with '${scheduledSurfaceGuid}'
       has multiple pages of results that we are not handling!`
      );
    }

    return res.Items as CuratedItemRecord[];
  }

  /**
   * retrieves item record by curatedRecId
   * @param curatedRecId curated feeds itemId in the readitla-tmp database
   * @returns CuratedItemRecord matching curated item record
   */
  public async getByCuratedRecId(
    curatedRecId: number
  ): Promise<CuratedItemRecord | null> {
    const input: GetCommandInput = {
      TableName: config.aws.dynamoDB.curationMigrationTable,
      Key: {
        curatedRecId: curatedRecId,
      },
    };

    const res = await this.client.send(new GetCommand(input));
    if (res.Item == null) {
      return null;
    }

    return {
      curatedRecId: res.Item.curatedRecId,
      scheduledSurfaceGuid: res.Item.scheduledSurfaceGuid,
      scheduledItemExternalId: res.Item.scheduledItemExternalId,
      approvedItemExternalId: res.Item.approvedItemExternalId,
      lastUpdatedAt: res.Item.lastUpdatedAt,
    };
  }

  /**
   * deletes a CuratedItemRecord from the dynamoDb
   *
   * @param curatedRecId
   */
  public async deleteByCuratedRecId(curatedRecId: number): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: config.aws.dynamoDB.curationMigrationTable,
        Key: {
          curatedRecId: curatedRecId,
        },
      })
    );
  }

  /**
   * Hydrate data required for CuratedItemRecord model from event body
   * @param eventBody the event data sent to the Event Bus, containing
   * information about the curated item
   * @returns Omit<CuratedItemRecord, 'curatedRecId'>
   */
  recordFromEvent(
    eventBody: ScheduledItemPayload
  ): Omit<CuratedItemRecord, 'curatedRecId'> {
    return {
      scheduledItemExternalId: eventBody.scheduledItemExternalId,
      approvedItemExternalId: eventBody.approvedItemExternalId,
      scheduledSurfaceGuid:
        ScheduledSurfaceGuid[eventBody.scheduledSurfaceGuid],
      lastUpdatedAt: Math.round(new Date().getTime() / 1000),
    };
  }

  /**
   * Insert/replace a CuratedItemRecord into the mapping for the given
   * curatedRecID and event body data
   * @param curatedRecId the legacy itemId in the readitla-tmp database,
   * to associate the record to
   * @param eventBody the event data sent to the Event Bus, containing
   * information about the curated item
   */
  public async upsertFromEvent(
    curatedRecId: number,
    eventBody: ScheduledItemPayload
  ): Promise<void> {
    const inputItem: CuratedItemRecord = {
      curatedRecId,
      ...this.recordFromEvent(eventBody),
    };
    await this.upsert(inputItem);
  }
  /**
   * Insert/replace a CuratedItemRecord into the mapping
   * @param data the CuratedItemRecord to insert
   */
  public async upsert(data: CuratedItemRecord) {
    const command = new PutCommand({
      TableName: config.aws.dynamoDB.curationMigrationTable,
      Item: data,
    });
    await dbClient.send(command);
  }
}
