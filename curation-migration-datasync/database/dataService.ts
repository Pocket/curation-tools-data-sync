import { Knex } from 'knex';
import {
  AddScheduledItemPayload,
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  TileSource,
} from '../types';
import config from '../config';
import {
  hydrateCuratedFeedItem,
  hydrateCuratedFeedProspectItem,
  hydrateCuratedFeedQueuedItem,
  hydrateTileSource,
} from './hydrator';
import { getTopicForReaditLaTmpDatabase } from '../helpers/topicMapper';

export class DataService {
  private db: Knex;
  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * hydrates all necessary fields for the database insertion and insert to
   * curated_feed_prospects, curated_feed_queued_items and curated_feed_items
   * and tile source under one transaction. returns curated_rec_id on success.
   * @param eventBody add-scheduled-item eventBody we receive from event bus
   * @param resolvedId resolvedId of the url in the event body. fetched from parser
   * @param domainId domainId returned by the parser
   */
  public async addScheduledItemTransaction(
    eventBody: AddScheduledItemPayload,
    resolvedId: number,
    domainId: string
  ): Promise<number> {
    const topicId = await this.getTopicIdByName(
      getTopicForReaditLaTmpDatabase(eventBody.topic)
    );

    const topDomainId = await this.fetchTopDomain(eventBody.url, domainId);

    const prospectItem = hydrateCuratedFeedProspectItem(
      eventBody,
      resolvedId,
      topDomainId
    );

    const trx = await this.db.transaction();
    try {
      prospectItem.prospect_id = await this.insertCuratedFeedProspectItem(
        trx,
        prospectItem
      );

      const queuedItem = hydrateCuratedFeedQueuedItem(prospectItem, topicId);

      queuedItem.queued_id = await this.insertCuratedFeedQueuedItem(
        trx,
        queuedItem
      );

      const curatedItem = hydrateCuratedFeedItem(
        queuedItem,
        eventBody.scheduledDate
      );
      curatedItem.curated_rec_id = await this.insertCuratedFeedItem(
        trx,
        curatedItem
      );

      await this.insertTileSource(trx, hydrateTileSource(curatedItem));

      await trx.commit();

      return curatedItem.curated_rec_id;
    } catch (e) {
      await trx.rollback();
      throw new Error(
        `failed to transact for the event body ${eventBody}, resolvedId: ${resolvedId}. \n ${e}`
      );
    }
  }

  /**
   * inserts into curated_feed_prospects table.
   * unique index on (feed_id and resolved_id)
   * @param trx
   * @param prospectItem
   * @returns prospect_id : primary key of the table
   */
  public async insertCuratedFeedProspectItem(
    trx: Knex.Transaction,
    prospectItem: CuratedFeedProspectItem
  ): Promise<number> {
    //unique on feedId and resolvedId
    const row = await trx(config.tables.curatedFeedProspects)
      .insert({
        ...prospectItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  /**
   * inserts to curated_feed_queued_items table
   * dependent on curated_feed_prospects table
   * unique index on (prospect_id) and (feed_id and resolved_id)
   * @param trx
   * @param queuedItem
   * @returns queued_id : primary key of the table
   */
  public async insertCuratedFeedQueuedItem(
    trx: Knex.Transaction,
    queuedItem: CuratedFeedQueuedItems
  ): Promise<number> {
    //unique on prospect_id
    const row = await trx(config.tables.curatedFeedQueuedItems)
      .insert({
        ...queuedItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  /**
   * inserts to curated_feed_items table.
   * dependent on curated_feed_prospect and curated_feed_queued_items table
   * unique index on (queued_id) and (feed_id and resolved_id)
   * @param trx
   * @param curatedFeedItem
   * @return curated_rec_id : primary key of the table
   */
  public async insertCuratedFeedItem(
    trx: Knex.Transaction,
    curatedFeedItem: CuratedFeedItem
  ): Promise<number> {
    const row = await trx(config.tables.curatedFeedItems)
      .insert({
        ...curatedFeedItem,
      })
      .onConflict()
      .merge();
    return row[0];
  }

  /**
   * inserts to the tile_source table.
   * dependent on curated_feed_items tables
   * unique index on (type, source_id)
   * @param trx
   * @param tileSource, curated_rec_id
   */
  public async insertTileSource(trx: Knex.Transaction, tileSource: TileSource) {
    await trx(config.tables.tileSource)
      .insert({
        ...tileSource,
      })
      .onConflict()
      .merge();
  }

  /**
   * Fetch the topic Id for the given topic name
   * @param topic
   * @returns topic_id matching with the topic
   */
  public async getTopicIdByName(topic: string): Promise<number> {
    const response = await this.db(config.tables.curatedFeedTopics)
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
  public async fetchTopDomain(url: string, parserDomainId: string) {
    const urlObj = new URL(url);
    // Syndicated articles are always getpocket.com/explore/item/some-slug
    if (
      urlObj.hostname === 'getpocket.com' &&
      urlObj.pathname.startsWith('/explore/item')
    ) {
      const slug = urlObj.pathname.split('/').pop() as string;
      return await this.queries.topDomainBySlug(slug);
    } else {
      return await this.queries.topDomainByDomainId(parserDomainId);
    }
  }

  queries = {
    topDomainByDomainId: async (domainId: string): Promise<number> => {
      const res = await this.db(config.tables.domains)
        .select('top_domain_id')
        .where('domain_id', domainId)
        .first();
      return res.top_domain_id;
    },
    topDomainBySlug: async (slug: string): Promise<number> => {
      const res = await this.db(config.tables.syndicatedArticles)
        .select('readitla_b.domains.top_domain_id')
        .join(
          'readitla_b.domains',
          'syndicated_articles.domain_id',
          'readitla_b.domains.domain_id'
        )
        .where('syndicated_articles.slug', slug)
        .first();
      return res.top_domain_id;
    },
  };
}
