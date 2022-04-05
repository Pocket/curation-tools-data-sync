import { Knex } from 'knex';
import {
  ScheduledItemPayload,
  CuratedFeedItem,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItems,
  TileSource,
  CuratedFeedItemModel,
  ApprovedItemPayload,
} from '../types';
import config from '../config';
import {
  hydrateCuratedFeedItem,
  hydrateCuratedFeedProspectItem,
  hydrateCuratedFeedQueuedItem,
  hydrateTileSource,
} from './hydrator';
import { getTopicForReaditLaTmpDatabase } from '../helpers/topicMapper';
import { getCuratorNameFromSso } from '../helpers/dataTransformers';

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
  public async addScheduledItem(
    eventBody: ScheduledItemPayload,
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
        `failed to transact for the event body
        ${JSON.stringify(eventBody)}, resolvedId: ${resolvedId} \n error: ${e}`
      );
    }
  }

  public async deleteScheduledItem(curatedRecId: number) {
    const item = await this.db<CuratedFeedItemModel>(
      config.tables.curatedFeedItems
    )
      .select(
        'prospect_id',
        'feed_id',
        'queued_id',
        'resolved_id',
        'status',
        'time_added',
        'time_updated',
        'time_live',
        'resolved_id'
      )
      .where('curated_rec_id', curatedRecId)
      .first();
    if (item == null) {
      throw new Error(`No record found for curatedRecId=${curatedRecId}`);
    }
    // Delete all related records and insert into audit table
    await this.db.transaction(async (trx) => {
      await trx(config.tables.curatedFeedItemsDeleted).insert({
        curated_rec_id: curatedRecId,
        feed_id: item.feed_id,
        resolved_id: item.resolved_id,
        prospect_id: item.prospect_id,
        queued_id: item.queued_id,
        status: item.status,
        time_live: item.time_live,
        time_added: item.time_added,
        time_updated: item.time_updated,
        deleted_user_id: config.db.deleteUserId,
      });
      await trx(config.tables.curatedFeedProspects)
        .where('prospect_id', item.prospect_id)
        .del();
      await trx(config.tables.curatedFeedQueuedItems)
        .where('queued_id', item.queued_id)
        .del();
      await trx(config.tables.curatedFeedItems)
        .where('curated_rec_id', curatedRecId)
        .del();
    });
  }

  /**
   * updates the curated_feed_prospects table and curated_feed_queued_items
   * fields, if they are set in the eventBody.
   * won't update the fields if they are set to null in the eventBody.
   * @param eventBody event body
   * @param curatedRecId curatedRecId corresponding to the approvedItem's externalId
   * @param domainId domain id from parser, optional field set only when
   *        publisher is not null in the event body.
   */
  public async updateApprovedItem(
    eventBody: ApprovedItemPayload,
    curatedRecId: number
  ): Promise<void> {
    const item = await this.db(config.tables.curatedFeedItems)
      .select()
      .join(
        config.tables.curatedFeedProspects,
        'curated_feed_prospects.prospect_id',
        'curated_feed_items.prospect_id'
      )
      .join(
        config.tables.curatedFeedQueuedItems,
        'curated_feed_queued_items.queued_id',
        'curated_feed_items.queued_id'
      )
      .where('curated_rec_id', curatedRecId)
      .first();

    let topicId;
    if (eventBody.topic) {
      topicId = await this.getTopicIdByName(
        getTopicForReaditLaTmpDatabase(eventBody.topic)
      );
    } else {
      topicId = item['topic_id'];
    }

    const curator = eventBody.createdBy
      ? getCuratorNameFromSso(eventBody.createdBy)
      : null;

    //update curated_feed_prosects and curated_feed_queued_items fields
    //if corresponding eventBody field is set,
    //otherwise set them to what's existing in the database
    await this.db.transaction(async (trx) => {
      await trx(config.tables.curatedFeedProspects)
        .update({
          title: eventBody.title ?? item?.title,
          excerpt: eventBody.excerpt ?? item.excerpt,
          time_updated: eventBody.updatedAt,
          curator: curator ?? item.curator,
          image_src: eventBody.imageUrl ?? item.image_src,
        })
        .where({
          prospect_id: item.prospect_id,
        });

      if (eventBody.topic || eventBody.createdBy) {
        await trx(config.tables.curatedFeedQueuedItems)
          .update({
            curator: curator,
            topic_id: topicId,
            time_updated: eventBody.updatedAt,
          })
          .where({
            queued_id: item['queued_id'],
          });
      }
      //not inserting to curated_feed_items table
      // as approvedItem won't have info on time_live
    });
  }
  /**
   * inserts into curated_feed_prospects table.
   * unique index on (feed_id and resolved_id)
   * @param trx
   * @param prospectItem
   * @returns prospect_id : primary key of the table
   */
  async insertCuratedFeedProspectItem(
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
  async insertCuratedFeedQueuedItem(
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
  async insertCuratedFeedItem(
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
  async insertTileSource(trx: Knex.Transaction, tileSource: TileSource) {
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
      return await this.topDomainBySlug(slug);
    } else {
      return await this.topDomainByDomainId(parserDomainId);
    }
  }

  /**
   * Fetch the top domain ID for the given domain ID. Used for non-syndicated
   * articles (syndicated articles will return Pocket domain, and should use
   * topDomainBySlug)
   */
  async topDomainByDomainId(domainId: string): Promise<number> {
    const res = await this.db(config.tables.domains)
      .select('top_domain_id')
      .where('domain_id', domainId)
      .first();
    return res.top_domain_id;
  }
  /**
   * Fetch the top domain ID for the given slug. Used for retrieving
   * the original domain ID of syndicated articles (re-hosted by Pocket)
   */
  async topDomainBySlug(slug: string): Promise<number> {
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
  }
}
