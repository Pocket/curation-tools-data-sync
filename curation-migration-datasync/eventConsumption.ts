import { getByScheduledItemExternalId } from './dynamodb/curatedItemIdMapper';
import { dbClient } from './dynamodb/dynamoDbClient';
import { CuratedItemService } from './curatedItemService';
import { writeClient } from './dbClient';
import { getTopicForReaditLaTmpDatabase } from './topicMapper';
import { getParserMetadata } from './parser';
import { fetchTopDomain } from './dataservice';
import {
  AddScheduledItemPayload,
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  ScheduledSurfaceToFeedIdMap,
  TileSource,
} from './types';

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

export async function addScheduledItem(eventBody: AddScheduledItemPayload) {
  let curatedRecId = await getByScheduledItemExternalId(
    dbClient,
    eventBody.scheduledItemId
  );
  const db = await writeClient();
  const curatedItemService = new CuratedItemService(db);
  const topic = getTopicForReaditLaTmpDatabase(eventBody.topic);
  const topicId = await curatedItemService.getTopicIdByName(topic);
  //todo: need to refactor to call parser only once.
  const parserResponse = await getParserMetadata(eventBody.url);
  const topDomainId = await fetchTopDomain(db, eventBody.url);

  //todo: all this needs to be wrapped in transactions
  const prospectItem: CuratedFeedProspectItem = {
    feed_id: ScheduledSurfaceToFeedIdMap[eventBody.scheduledSurfaceGuid],
    resolved_id: parserResponse.resolvedId,
    type: null,
    status: 'ready',
    curator: getCuratorNameFromSso(eventBody.createdBy),
    time_added: eventBody.createdAt,
    time_updated: eventBody.updatedAt,
    top_domain_id: topDomainId,
    title: eventBody.title,
    excerpt: eventBody.excerpt,
    image_src: eventBody.imageUrl,
  };
  prospectItem.prospect_id =
    await curatedItemService.insertCuratedFeedProspectItem(prospectItem);

  const queuedItem: CuratedFeedQueuedItems = {
    prospect_id: prospectItem.prospect_id,
    feed_id: prospectItem.feed_id,
    resolved_id: prospectItem.resolved_id,
    time_added: prospectItem.time_added,
    time_updated: prospectItem.time_updated,
    curator: prospectItem.curator,
    status: 'ready',
    topic_id: topicId,
    relevance_length: 'week',
    weight: 1,
  };
  queuedItem.queued_id = await curatedItemService.insertCuratedFeedQueuedItem(
    queuedItem
  );

  const curatedFeedItem: CuratedFeedItem = {
    queued_id: queuedItem.queued_id,
    feed_id: queuedItem.feed_id,
    status: 'live',
    prospect_id: queuedItem.prospect_id,
    resolved_id: queuedItem.resolved_id,
    time_added: queuedItem.time_added,
    time_updated: queuedItem.time_updated,
    time_live: convertDateToTimestamp(eventBody.scheduledDate),
  };
  curatedFeedItem.curated_rec_id =
    await curatedItemService.insertCuratedFeedItem(curatedFeedItem);

  let tileSource: TileSource = {
    source_id: curatedFeedItem.curated_rec_id,
  };

  await curatedItemService.writeToTileSource(tileSource);

  return curatedFeedItem.curated_rec_id;
}
