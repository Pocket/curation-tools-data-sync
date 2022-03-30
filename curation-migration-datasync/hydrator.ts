import {
  AddScheduledItemPayload,
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  ScheduledSurfaceToFeedIdMap,
} from './types';
import { convertDateToTimestamp, getCuratorNameFromSso } from './eventConsumer';

export function hydrateCuratedFeedItem(
  queuedItem: CuratedFeedQueuedItems,
  scheduledDate: string
): CuratedFeedItem {
  return {
    queued_id: queuedItem.queued_id,
    feed_id: queuedItem.feed_id,
    status: 'live',
    prospect_id: queuedItem.prospect_id,
    resolved_id: queuedItem.resolved_id,
    time_added: queuedItem.time_added,
    time_updated: queuedItem.time_updated,
    time_live: convertDateToTimestamp(scheduledDate),
    //will be populated from the database
    curated_rec_id: 0,
  };
}

export function hydrateCuratedFeedProspectItem(
  eventBody: AddScheduledItemPayload,
  parserResponse,
  topDomainId
): CuratedFeedProspectItem {
  return {
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
    //will be populated from the database
    prospect_id: 0,
  };
}

export function hydrateCuratedFeedQueuedItem(
  prospectItem: CuratedFeedProspectItem,
  topicId: number
): CuratedFeedQueuedItems {
  return {
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
    //will be populated from the database
    queued_id: 0,
  };
}
