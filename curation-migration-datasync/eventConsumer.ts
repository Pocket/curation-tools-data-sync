import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { ApprovedItemPayload, ScheduledItemPayload } from './types';
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
  db: Knex,
) {
  const curatedItemModel = new CuratedItemRecordModel();
  const scheduledItem = await curatedItemModel.getByScheduledItemExternalId(
    eventBody.scheduledItemExternalId,
  );

  if (scheduledItem) {
    console.log(`duplicate add-scheduled-item event, ${JSON.stringify(
      scheduledItem,
    )}. 
    scheduledItemExternalId is already present in the id mapping dynamo table `);
    //ignore duplicate events
    return;
  }

  const parserResponse = await getParserMetadata(eventBody.url);
  const dbService = new DataService(db);

  // Insert into the legacy database and retrieve ID for mapping
  const curatedRecId = await dbService.addScheduledItem(
    eventBody,
    parseInt(parserResponse.resolvedId),
    parserResponse.domainId,
  );

  // Create mapping record in DynamoDB
  await curatedItemModel.upsertFromEvent(curatedRecId, eventBody);
}

/**
 * Remove scheduled item from dynamoDB mapping and legacy database
 * @param eventBody event payload; only need scheduledItemExternalId
 * @param db db connection
 */
export async function removeScheduledItem(
  eventBody: ScheduledItemPayload,
  db: Knex,
) {
  const dbService = new DataService(db);
  const curatedItemModel = new CuratedItemRecordModel();
  const curatedRecord = await curatedItemModel.getByScheduledItemExternalId(
    eventBody.scheduledItemExternalId,
  );
  if (curatedRecord == null) {
    throw new Error(
      `No mapping found for scheduledItemExternalId=${eventBody.scheduledItemExternalId}`,
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
  db: Knex,
) {
  const curatedItemModel = new CuratedItemRecordModel();
  const scheduledItem = await curatedItemModel.getByScheduledItemExternalId(
    eventBody.scheduledItemExternalId,
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
    parserResponse.domainId,
  );

  await curatedItemModel.upsertFromEvent(scheduledItem.curatedRecId, eventBody);
}

/**
 * fetches all curatedRecId related to the approvedItem's externalId.
 * and updates them.
 * @param eventBody
 */
export async function updateApprovedItem(
  eventBody: ApprovedItemPayload,
  db: Knex,
) {
  // dynamoDb will have a record of curatedRecId mapped to approvedItem
  // only if it was previously scheduled.
  const curatedItemModel = new CuratedItemRecordModel();
  const curatedItems = await curatedItemModel.getByApprovedItemExternalId(
    eventBody.approvedItemExternalId,
  );

  //if dynamo returns 0 curatedItem, then the approvedItem was not scheduled before,
  //so we can safely ignore this event.
  if (curatedItems.length == 0) {
    return;
  }

  //if there are approvedItem in the dynamoDb, they must be scheduled before.
  //all scheduled item has a record in our legacy database.
  // so we update them as per the new eventBody.
  for (const curatedItem of curatedItems) {
    try {
      const dbService = new DataService(db);
      await dbService.updateApprovedItem(eventBody, curatedItem.curatedRecId);
      //update lastUpdatedAt alone in dynamoDb.
      curatedItem.lastUpdatedAt = Math.round(new Date().getTime() / 1000);
      await curatedItemModel.upsert(curatedItem);
    } catch (e) {
      //logging error and iterate to next item
      console.log(
        `updateApprovedItem event failed for event: ${JSON.stringify(
          eventBody,
        )}, ${e}`,
      );
      Sentry.captureException(
        `updateApprovedItem event failed for event: ${JSON.stringify(
          eventBody,
        )}, ${e}`,
      );
    }
  }
}
