export type ScheduledItemPayload = {
  eventType: string;
  scheduledItemExternalId: string;
  approvedItemExternalId: string;
  url: string;
  title: string;
  excerpt: string;
  language: string;
  publisher: string;
  imageUrl: string;
  topic: string;
  isSyndicated: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  scheduledSurfaceGuid: string;
  scheduledDate: string;
};

export type ApprovedItemPayload = {
  eventType: string;
  approvedItemExternalId: string;
  url: string;
  title?: string | null;
  excerpt?: string | null;
  language?: string | null;
  publisher?: string | null;
  imageUrl?: string | null;
  topic?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  isSyndicated?: boolean;
};

//these events are defined in eventBridge in .aws folder
export enum EventDetailType {
  ADD_SCHEDULED_ITEM = 'add-scheduled-item',
  UPDATE_APPROVED_ITEM = 'update-approved-item',
  UPDATE_SCHEDULED_ITEM = 'update-scheduled-item',
  REMOVE_SCHEDULED_ITEM = 'remove-scheduled-item',
}

//feed_id mapping in curated-feeds table
export enum ScheduledSurfaceToFeedIdMap {
  NEW_TAB_EN_US = 1,
  NEW_TAB_DE_DE = 3,
  NEW_TAB_EN_GB = 6,
  NEW_TAB_EN_INTL = 8,
  SANDBOX = 2,
}

export type CuratedFeedProspectItem = {
  prospect_id?: number;
  feed_id: number;
  resolved_id: number;
  type: string | null;
  status: 'ready';
  curator: string;
  time_added: number;
  time_updated: number;
  top_domain_id: number;
  title: string;
  excerpt: string;
  image_src: string;
};

export type CuratedFeedQueuedItem = {
  prospect_id: number;
  feed_id: number;
  resolved_id: number;
  status: 'ready';
  curator: string;
  time_added: number;
  time_updated: number;
  queued_id?: number;
  relevance_length: 'week';
  topic_id: number;
  weight: 1;
};

export type CuratedFeedItem = {
  curated_rec_id?: number;
  prospect_id: number;
  feed_id: number;
  resolved_id: number;
  queued_id: number;
  status: 'live';
  time_live: number;
  time_added: number;
  time_updated: number;
};

export type TileSource = {
  tile_id?: number;
  source_id: number;
};

export type CuratedFeedItemModel = {
  curated_rec_id: number;
  feed_id: number;
  resolved_id: number;
  prospect_id: number;
  queued_id: number;
  status: 'live' | 'removed' | 'spoc';
  time_live: number;
  time_added: number;
  time_updated: number;
};
