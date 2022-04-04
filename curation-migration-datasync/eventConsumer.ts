import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { AddScheduledItemPayload } from './types';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { Knex } from 'knex';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';

/**
 * fetches necessary field for database insertion and provide them to dataService.
 * If database insertion is successful,
 * adds the curatedRecId and externalIds from the event to the dynamoDb
 * @param eventBody
 */
export async function addScheduledItem(
  eventBody: AddScheduledItemPayload,
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
 * fetches all curatedRecId related to the approvedItem's externalId.
 * and updates them.
 * @param eventBody
 */
export async function updatedApprovedItem(
  eventBody: AddScheduledItemPayload,
  db: Knex
) {
  // dynamoDb will have a record of the approvedItem only if it's scheduled.
  const curatedItemModel = new CuratedItemRecordModel();
  const curatedItems = await curatedItemModel.getByApprovedItemExternalId(
    eventBody.approvedItemExternalId
  );

  //if the record returns 0, then the approvedItem is not scheduled,
  //so we can safely ignore this event.
  if (curatedItems.length == 0) {
    return;
  }

  //if there are approvedItem in the dynamoDb, they must be scheduled before.
  //so we go ahead and update them as per the new eventBody in the legacy database.
  for (let curatedItem of curatedItems) {
    try {
      const dbService = new DataService(db);

      if (eventBody.publisher) {
        //fetch domainId from parser only when publisher is changed.
        //resolved_id is not expected to change for the url.
        const parserResponse = await getParserMetadata(eventBody.url);
        await dbService.updateApprovedItem(
          eventBody,
          curatedItem.curatedRecId,
          parserResponse.domainId
        );
      } else {
        //don't send domain_id when publisher is not changed.
        await dbService.updateApprovedItem(eventBody, curatedItem.curatedRecId);
      }

      //update lastUpdatedAt alone.
      curatedItem.lastUpdatedAt = Math.round(new Date().getTime() / 1000);
      await curatedItemModel.insert(curatedItem);
    } catch (e) {
      throw new Error(
        `updateApprovedItem for ${eventBody}. couldnt find ${curatedItem.curatedRecId}`
      );
    }
  }
}
