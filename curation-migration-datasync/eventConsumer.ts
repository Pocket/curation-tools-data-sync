import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { AddScheduledItemPayload } from './types';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { Knex } from 'knex';

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
