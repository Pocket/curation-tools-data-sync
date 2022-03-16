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

export type ImportApprovedCuratedCorpusItemPayload = {
  approvedItem: ApprovedItem;
  scheduledItem: ScheduledItem;
};
