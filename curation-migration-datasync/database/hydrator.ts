import {
  ScheduledItemPayload,
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItem,
  ScheduledSurfaceToFeedIdMap,
  TileSource,
} from '../types';
import {
  convertDateToTimestamp,
  getCuratorNameFromSso,
} from '../helpers/dataTransformers';

export function hydrateCuratedFeedItem(
  queuedItem: CuratedFeedQueuedItem,
  scheduledDate: string
): CuratedFeedItem {
  if (queuedItem.queued_id == undefined) {
    throw new Error(`queued_id cannot be undefined in ${queuedItem}`);
  }

  return {
    queued_id: queuedItem.queued_id,
    feed_id: queuedItem.feed_id,
    status: 'live',
    prospect_id: queuedItem.prospect_id,
    resolved_id: queuedItem.resolved_id,
    time_added: queuedItem.time_added,
    time_updated: queuedItem.time_updated,
    time_live: convertDateToTimestamp(scheduledDate),
  };
}

export function hydrateCuratedFeedProspectItem(
  eventBody: ScheduledItemPayload,
  resolvedId: number,
  topDomainId: number
): CuratedFeedProspectItem {
  return {
    feed_id: ScheduledSurfaceToFeedIdMap[eventBody.scheduledSurfaceGuid],
    resolved_id: resolvedId,
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
}

export function hydrateCuratedFeedQueuedItem(
  prospectItem: CuratedFeedProspectItem,
  topicId: number
): CuratedFeedQueuedItem {
  if (prospectItem.prospect_id == undefined) {
    throw new Error(`prospect_id cannot be undefined in  ${prospectItem}`);
  }
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
  };
}

export function hydrateTileSource(curatedItem: CuratedFeedItem): TileSource {
  if (curatedItem.curated_rec_id == undefined) {
    throw new Error(`curated_rec_id cannot be undefined in ${curatedItem}`);
  }

  return {
    source_id: curatedItem.curated_rec_id,
  };
}
