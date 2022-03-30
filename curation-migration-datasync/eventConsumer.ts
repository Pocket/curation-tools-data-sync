import { CuratedItemService } from './curatedItemService';
import { writeClient } from './dbClient';
import { getTopicForReaditLaTmpDatabase } from './topicMapper';
import { getParserMetadata } from './parser';
import { fetchTopDomain } from './dataservice';
import { AddScheduledItemPayload, TileSource } from './types';
import {
  hydrateCuratedFeedItem,
  hydrateCuratedFeedProspectItem,
  hydrateCuratedFeedQueuedItem,
} from './hydrator';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { insertCuratedItem } from './dynamodb/curatedItemIdMapper';
import { dbClient } from './dynamodb/dynamoDbClient';

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
 * converts the event body of `add-scheduled-item` event to database models,
 * and inserts them to the database within one transaction. If successful,
 * adds the curatedRecId and externalIds from the event to the dynamoDb
 * @param eventBody
 */
export async function addScheduledItem(eventBody: AddScheduledItemPayload) {
  let curatedRecId: number = -1;
  const db = await writeClient();
  const curatedItemService = new CuratedItemService(db);

  const topicId = await curatedItemService.getTopicIdByName(
    getTopicForReaditLaTmpDatabase(eventBody.topic)
  );

  //todo: refactor getParser amd fetchDomain such that
  //parser gets called only once in the workflow.
  const parserResponse = await getParserMetadata(eventBody.url);
  const topDomainId = await fetchTopDomain(db, eventBody.url);

  let prospectItem = hydrateCuratedFeedProspectItem(
    eventBody,
    parserResponse,
    topDomainId
  );

  await db.transaction(async (trx) => {
    prospectItem.prospect_id =
      await curatedItemService.insertCuratedFeedProspectItem(trx, prospectItem);

    let queuedItem = hydrateCuratedFeedQueuedItem(prospectItem, topicId);

    queuedItem.queued_id = await curatedItemService.insertCuratedFeedQueuedItem(
      trx,
      queuedItem
    );

    let curatedItem = hydrateCuratedFeedItem(
      queuedItem,
      eventBody.scheduledDate
    );
    curatedRecId = await curatedItemService.insertCuratedFeedItem(
      trx,
      curatedItem
    );

    let tileSource: TileSource = {
      source_id: curatedRecId,
    };

    await curatedItemService.insertTileSource(trx, tileSource);
  });

  if (curatedRecId === -1) {
    throw new Error(
      `curatedRecId is not generated for the eventBody ${eventBody}`
    );
  }

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
  let curatedItemRecord: CuratedItemRecord = {
    curatedRecId: curatedRecId,
    scheduledItemExternalId: eventBody.scheduledItemExternalId,
    approvedItemExternalId: eventBody.approvedItemExternalId,
    scheduledSurfaceGuid: ScheduledSurfaceGuid[eventBody.scheduledSurfaceGuid],
    lastUpdatedAt: Math.round(new Date().getTime() / 1000),
  };

  await insertCuratedItem(dbClient, curatedItemRecord);
}
