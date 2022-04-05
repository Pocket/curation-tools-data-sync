import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { ApprovedItemPayload, ScheduledItemPayload } from './types';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { Knex } from 'knex';

/**
 * fetches necessary field for database insertion and provide them to dataService.
 * If database insertion is successful,
 * adds the curatedRecId and externalIds from the event to the dynamoDb
 * @param eventBody
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
 * fetches all curatedRecId related to the approvedItem's externalId.
 * and updates them.
 * @param eventBody
 */
export async function updatedApprovedItem(
  eventBody: ApprovedItemPayload,
  db: Knex
) {
  // dynamoDb will have a record of curatedRecId mapped to approvedItem
  // only if it was previously scheduled.
  const curatedItemModel = new CuratedItemRecordModel();
  const curatedItems = await curatedItemModel.getByApprovedItemExternalId(
    eventBody.approvedItemExternalId
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
      await curatedItemModel.insert(curatedItem);
    } catch (e) {
      throw new Error(
        `updateApprovedItem for ${eventBody}. couldn't find ${curatedItem.curatedRecId}`
      );
    }
  }
}
