import { Knex } from 'knex';
import {
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  TileSource,
} from './types';

export class CuratedItemService {
  private db: Knex;
  constructor(db: Knex) {
    this.db = db;
  }

  public insertCuratedFeedProspectItem(
    prospectItem: CuratedFeedProspectItem
  ): number {
    return 0;
  }

  public insertCuratedFeedQueuedItem(
    queuedItem: CuratedFeedQueuedItems
  ): number {
    return 0;
  }

  public async insertCuratedFeedItem(curatedFeedItem: CuratedFeedItem) {
    return 0;
  }

  public async writeToTileSource(tileSource: TileSource) {
    return 0;
  }

  public async getTopicIdByName(topic: string): Promise<number> {
    const response = await this.db('curated-feed-topics')
      .select('topic_id')
      .where({
        name: topic,
      });

    return response['topic_id'];
  }

  public async addScheduledCuratedFeedItem(eventBody: cur);
}
