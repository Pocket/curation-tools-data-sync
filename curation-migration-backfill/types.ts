export enum EVENT {
  CURATION_MIGRATION_BACKFILL = 'curation-migration-backfill',
}

export interface BackfillMessage {
  curated_rec_id: string;
  time_live: number;
  time_added: number;
  time_updated: number;
  title: string;
  excerpt: string;
  curator: string | null;
  image_src: string;
  resolved_id: number;
  resolved_url: string;
  lang: string;
  topic_name: string | null;
  feed_id: number;
  slug: string;
}

export interface CorpusInput {
  url: string;
  title: string;
  excerpt: string;
  status: 'RECOMMENDATION';
  language: string;
  publisher: string;
  imageUrl: string;
  topic: string | null;
  source: 'BACKFILL';
  isCollection: boolean;
  isSyndicated: boolean;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledSurfaceGuid: string;
}

export type ProspectInfo = Pick<
  CorpusInput,
  'isCollection' | 'isSyndicated' | 'publisher'
>;

export enum CuratedStatus {
  RECOMMENDATION = 'RECOMMENDATION',
  CORPUS = 'CORPUS',
}

export type ApprovedItem = {
  externalId: string;
  prospectId: string | null;
  url: string;
  title: string;
  excerpt: string;
  status: CuratedStatus;
  language: string;
  publisher: string;
  imageUrl: string;
  topic: string;
  isCollection: boolean;
  isTimeSensitive: boolean;
  isSyndicated: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string | null;
};

export type ScheduledItem = {
  externalId: string;
  approvedItemId: number;
  scheduledSurfaceGuid: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string | null;
  scheduledDate: Date;
};

export type ImportApprovedCorpusItemPayload = {
  approvedItem: ApprovedItem;
  scheduledItem: ScheduledItem;
};

export interface ImportApprovedCorpusItemMutationResponse {
  data: {
    importApprovedCorpusItem: ImportApprovedCorpusItemPayload;
  };
}
