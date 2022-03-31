import { DataService } from './database/dataService';
import { getParserMetadata } from './externalCaller/parser';
import { AddScheduledItemPayload } from './types';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { insertCuratedItem } from './dynamodb/curatedItemIdMapper';
import { dbClient } from './dynamodb/dynamoDbClient';
import { Knex } from 'knex';

/**
 * function to generate epoc timestamp
 * @param scheduledDate
 */
export function convertDateToTimestamp(scheduledDate: string) {
  return Math.round(new Date(scheduledDate).getTime() / 1000);
}

/**
 * fetches `cohara` from 'ad|Mozilla-LDAP|cohara'
 * @param ssoName
 */
export function getCuratorNameFromSso(ssoName: string) {
  const prefix = 'ad|Mozilla-LDAP|';
  if (!ssoName.startsWith(prefix)) {
    throw new Error(
      'unexpected sso format, createdBy are expected to startWith `ad|Mozilla-LDAP|`'
    );
  }
  return ssoName.substring(prefix.length);
}

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

  const curatedRecId = await dbService.addScheduledItem(
    eventBody,
    parseInt(parserResponse.resolvedId),
    parserResponse.domainId
  );

  await insertAddedScheduledItem(curatedRecId, eventBody);
}

/**
 * function to generate curatedItemRecord to add to dynamoDb
 * @param curatedRecId
 * @param eventBody
 */
export async function insertAddedScheduledItem(
  curatedRecId: number,
  eventBody: AddScheduledItemPayload
) {
  const curatedItemRecord: CuratedItemRecord = {
    curatedRecId: curatedRecId,
    scheduledItemExternalId: eventBody.scheduledItemExternalId,
    approvedItemExternalId: eventBody.approvedItemExternalId,
    scheduledSurfaceGuid: ScheduledSurfaceGuid[eventBody.scheduledSurfaceGuid],
    lastUpdatedAt: Math.round(new Date().getTime() / 1000),
  };

  await insertCuratedItem(dbClient, curatedItemRecord);
}
