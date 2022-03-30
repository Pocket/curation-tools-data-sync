import { Knex } from 'knex';
import {
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  TileSource,
} from '../types';
import { queries } from './dbClient';
import config from '../config';

export class DataService {
  private db: Knex;
  constructor(db: Knex) {
    this.db = db;
  }

  public async insertCuratedFeedProspectItem(
    trx: Knex.Transaction,
    prospectItem: CuratedFeedProspectItem
  ): Promise<any> {
    //unique on feedId and resolvedId
    const row = await trx(config.tables.curated_feed_prospects)
      .insert({
        ...prospectItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  public async insertCuratedFeedQueuedItem(
    trx: Knex.Transaction,
    queuedItem: CuratedFeedQueuedItems
  ): Promise<number> {
    //unique on prospect_id
    const row = await trx(config.tables.curated_feed_queued_items)
      .insert({
        ...queuedItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  public async insertCuratedFeedItem(
    trx: Knex.Transaction,
    curatedFeedItem: CuratedFeedItem
  ) {
    const row = await trx(config.tables.curated_feed_items)
      .insert({
        ...curatedFeedItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  public async insertTileSource(trx: Knex.Transaction, tileSource: TileSource) {
    const row = await trx(config.tables.tile_source)
      .insert({
        ...tileSource,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  public async getTopicIdByName(topic: string): Promise<number> {
    const response = await this.db(config.tables.curated_feed_topics)
      .select('topic_id')
      .where({
        name: topic,
      })
      .first();

    return response['topic_id'];
  }

  /**
   * Fetch the top domain ID for the given url and domain ID
   */
  public static async fetchTopDomain(
    conn: Knex,
    url: string,
    parserDomainId: string
  ) {
    const urlObj = new URL(url);
    // Syndicated articles are always getpocket.com/explore/item/some-slug
    if (
      urlObj.hostname === 'getpocket.com' &&
      urlObj.pathname.startsWith('/explore/item')
    ) {
      const slug = urlObj.pathname.split('/').pop() as string;
      return await queries.topDomainBySlug(conn, slug);
    } else {
      return await queries.topDomainByDomainId(conn, parserDomainId);
    }
  }
}
