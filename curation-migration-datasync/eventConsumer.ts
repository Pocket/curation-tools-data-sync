import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { ScheduledItemPayload } from './types';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { Knex } from 'knex';
import * as Sentry from '@sentry/serverless';

/**
 * fetches necessary field for database insertion and provide them to dataService.
 * If database insertion is successful,
 * adds the curatedRecId and externalIds from the event to the dynamoDb
 * @param eventBody
 * @param db
 */
export async function addScheduledItem(
  eventBody: ScheduledItemPayload,
  db: Knex
) {
  const dbService = new DataService(db);
  const parserResponse = await getParserMetadata(eventBody.url);

  // Insert into the legacy database and retrieve ID for mapping
  const curatedRecId = await dbService.addScheduledItem(
    eventBody,
    parseInt(parserResponse.resolvedId),
    parserResponse.domainId
  );

  // Create mapping record in DynamoDB
  const curatedItemModel = new CuratedItemRecordModel();
  await curatedItemModel.insertFromEvent(curatedRecId, eventBody);
}

/**
 * Remove scheduled item from dynamoDB mapping and legacy database
 * @param eventBody event payload; only need scheduledItemExternalId
 * @param db db connection
 */
export async function removeScheduledItem(
  eventBody: ScheduledItemPayload,
  db: Knex
) {
  const dbService = new DataService(db);
  const curatedItemModel = new CuratedItemRecordModel();
  const curatedRecord = await curatedItemModel.getByScheduledItemExternalId(
    eventBody.scheduledItemExternalId
  );
  if (curatedRecord == null) {
    throw new Error(
      `No mapping found for scheduledItemExternalId=${eventBody.scheduledItemExternalId}`
    );
  }

  // Delete records in legacy database
  await dbService.deleteScheduledItem(curatedRecord.curatedRecId);

  // Remove association from DynamoDB
  await curatedItemModel.deleteByCuratedRecId(curatedRecord.curatedRecId);
}

/**
 * Update the scheduled item in the legacy database based on the curatedRecId
 * from the DynamoDB. If the DynamoDB mapping is not found, treat the event
 * the same as an add-scheduled-item event.
 * @param eventBody
 * @param db
 */
export async function updateScheduledItem(
  eventBody: ScheduledItemPayload,
  db: Knex
) {
  const curatedItemModel = new CuratedItemRecordModel();
  const scheduledItem = await curatedItemModel.getByScheduledItemExternalId(
    eventBody.scheduledItemExternalId
  );

  if (!scheduledItem) {
    const errorMessage = `update-scheduled-item: No mapping found for scheduledItemExternalId=${eventBody.scheduledItemExternalId}`;
    Sentry.captureMessage(errorMessage);
    console.log(errorMessage);
    await addScheduledItem(eventBody, db);
    return;
  }

  const dbService = new DataService(db);
  const parserResponse = await getParserMetadata(eventBody.url);

  await dbService.updateScheduledItem(
    eventBody,
    scheduledItem.curatedRecId,
    parseInt(parserResponse.resolvedId),
    parserResponse.domainId
  );
}
