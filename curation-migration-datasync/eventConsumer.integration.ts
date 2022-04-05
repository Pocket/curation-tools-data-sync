import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import * as SecretManager from '../curation-migration-datasync/secretManager';
import sinon from 'sinon';
import { writeClient } from './database/dbClient';
import { ScheduledItemPayload, EventDetailType } from './types';
import nock from 'nock';
import config from './config';
import { Knex } from 'knex';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { DataService } from './database/dataService';
import { convertDateToTimestamp } from './helpers/dataTransformers';
import { addScheduledItem, removeScheduledItem } from './eventConsumer';

const curatedRecordModel = new CuratedItemRecordModel();

describe('event consumption integration test', function () {
  const timestamp1 = Math.round(new Date('2020-10-10').getTime() / 1000);
  const curatedItemRecords: CuratedItemRecord[] = [
    {
      curatedRecId: 2,
      scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_US,
      scheduledItemExternalId: 'random_scheduled_guid_2',
      approvedItemExternalId: 'random_approved_guid_2',
      lastUpdatedAt: timestamp1,
    },
  ];

  let db;

  beforeAll(async () => {
    sinon.stub(SecretManager, 'getDbCredentials').resolves({
      host: 'localhost',
      username: 'root',
      password: '',
      port: config.db.port,
    });
    db = await writeClient();
  });

  beforeEach(async () => {
    await truncateDynamoDb(dbClient);
    await db(config.tables.curatedFeedProspects).truncate();
    await db(config.tables.curatedFeedItems).truncate();
    await db(config.tables.curatedFeedQueuedItems).truncate();

    //populating the database
    await Promise.all(
      curatedItemRecords.map((item) => {
        curatedRecordModel.insert(item);
      })
    );

    await db(config.tables.curatedFeedTopics).truncate();
    await db(config.tables.curatedFeedTopics).insert({
      topic_id: 1,
      name: 'Self Improvement',
      status: 'live',
    });

    await db(config.tables.domains).truncate();
    const inputDomainData = [
      {
        domain_id: 123,
        domain: 'https://stackoverflow.blog',
        top_domain_id: 100,
      },
      {
        domain_id: 456,
        domain: 'nytimes.com',
        top_domain_id: 200,
      },
    ].map((row) => {
      return {
        domain_id: row.domain_id,
        domain: row.domain,
        top_domain_id: row.top_domain_id,
      };
    });
    await db(config.tables.domains).insert(inputDomainData);

    await db(config.tables.syndicatedArticles).truncate();
    await db(config.tables.syndicatedArticles).insert({
      resolved_id: 0,
      original_resolved_id: 0,
      author_user_id: 1,
      status: 1,
      hide_images: 0,
      publisher_url: 'nytimes.com',
      domain_id: 456,
      publisher_id: 1,
      slug: 'the-most-important-scientific-problems-have-yet-to-be-solved',
    });
  });

  afterEach(async () => {
    await truncateDynamoDb(dbClient);
    sinon.restore();
  });

  afterAll(async () => {
    await db.destroy();
  });
  describe('remove-scheduled-item', () => {
    describe('error handling', () => {
      it('throws error if curatedRecId is not found in database', async () => {
        const testEventBody = {
          eventType: EventDetailType.DELETE_SCHEDULED_ITEM,
          scheduledItemExternalId: 'random_scheduled_guid_2',
          // other fields we don't need
        } as ScheduledItemPayload;
        await expect(removeScheduledItem(testEventBody, db)).rejects.toThrow(
          'No record found for curatedRecId'
        );
      });
      it('throws error if the scheduledItemExternalId is not present in dynamo map', async () => {
        const testEventBody = {
          eventType: EventDetailType.DELETE_SCHEDULED_ITEM,
          scheduledItemExternalId: 'not_a_real_guid_1',
          // other fields we don't need
        } as ScheduledItemPayload;
        await expect(removeScheduledItem(testEventBody, db)).rejects.toThrow(
          'No mapping found for scheduledItemExternalId'
        );
      });
    });
    describe('happy path', () => {
      const count = async (
        table: string,
        where: Record<string, any>
      ): Promise<number> => {
        return db(table)
          .where(where)
          .count('* as count')
          .then((rows) => rows[0].count);
      };
      const curatedRecord = {
        curated_rec_id: 2,
        prospect_id: 10,
        feed_id: 9,
        queued_id: 12,
        resolved_id: 99,
        status: 'live',
        time_added: 1649094016,
        time_updated: 1649094017,
        time_live: 1649094018,
      };

      beforeEach(async () => {
        await db(config.tables.curatedFeedItems).insert(curatedRecord);
      });
      afterEach(async () => {
        await Promise.all(
          [
            config.tables.curatedFeedProspects,
            config.tables.curatedFeedQueuedItems,
            config.tables.curatedFeedItems,
            config.tables.curatedFeedItemsDeleted,
          ].map((table) => db(table).truncate())
        );
      });
      it('deletes records and updates audit table', async () => {
        const testEventBody = {
          eventType: EventDetailType.DELETE_SCHEDULED_ITEM,
          scheduledItemExternalId: 'random_scheduled_guid_2',
          // other fields we don't need
        } as ScheduledItemPayload;
        await removeScheduledItem(testEventBody, db);
        const auditRecord = await db(config.tables.curatedFeedItemsDeleted)
          .where({ curated_rec_id: 2 })
          .first();
        expect(auditRecord).toMatchObject(curatedRecord);
        expect(auditRecord.deleted_user_id).toEqual(config.db.deleteUserId);
        [
          {
            table: config.tables.curatedFeedProspects,
            where: { prospect_id: 10 },
          },
          {
            table: config.tables.curatedFeedQueuedItems,
            where: { queued_id: 12 },
          },
          {
            table: config.tables.curatedFeedItems,
            where: { curated_rec_id: 2 },
          },
        ].forEach(async ({ table, where }) => {
          expect(await count(table, where)).toEqual(0);
        });
        expect(await curatedRecordModel.getByCuratedRecId(2)).toBeNull();
      });
    });
  });

  describe('add-scheduled-item', () => {
    const testEventBody = {
      eventType: EventDetailType.ADD_SCHEDULED_ITEM,
      scheduledItemExternalId: 'random_scheduled_guid_1',
      approvedItemExternalId: 'random_approved_guid_1',
      url: 'https://stackoverflow.blog/',
      title: 'Sync the new tool with legacy database',
      excerpt: 'will be deprecated soon',
      language: 'EN',
      publisher: 'Pocket blog',
      imageUrl: 'https://some-s3-url.com',
      topic: 'SELF_IMPROVEMENT',
      isSyndicated: false,
      createdAt: 1648593897,
      createdBy: 'ad|Mozilla-LDAP|sri',
      updatedAt: 1648593897,
      scheduledSurfaceGuid: 'NEW_TAB_EN_US',
      scheduledDate: '2022-03-25',
    };

    async function assertTables(
      testEventBody: ScheduledItemPayload,
      db: Knex,
      topDomainId: number
    ) {
      const curatedItemRecord =
        await curatedRecordModel.getByScheduledItemExternalId(
          'random_scheduled_guid_1'
        );
      expect(curatedItemRecord?.approvedItemExternalId).toEqual(
        testEventBody.approvedItemExternalId
      );
      expect(curatedItemRecord?.scheduledSurfaceGuid).toEqual(
        testEventBody.scheduledSurfaceGuid
      );

      const curatedItem = await db(config.tables.curatedFeedItems)
        .select()
        .where({
          curated_rec_id: curatedItemRecord?.curatedRecId,
        })
        .first();

      expect(curatedItem.time_live).toEqual(
        convertDateToTimestamp(testEventBody.scheduledDate)
      );
      expect(curatedItem.feed_id).toEqual(1);
      expect(curatedItem.resolved_id).toEqual(12345);
      expect(curatedItem.status).toEqual('live');
      expect(curatedItem.time_added).toEqual(testEventBody.createdAt);
      expect(curatedItem.time_updated).toEqual(testEventBody.updatedAt);

      const queuedItems = await db(config.tables.curatedFeedQueuedItems)
        .select()
        .where({
          queued_id: curatedItem.queued_id,
        })
        .first();

      expect(queuedItems.feed_id).toEqual(1);
      expect(queuedItems.resolved_id).toEqual(12345);
      expect(queuedItems.curator).toEqual('sri');
      expect(queuedItems.relevance_length).toEqual('week');
      expect(queuedItems.topic_id).toEqual(1);
      expect(queuedItems.time_added).toEqual(testEventBody.createdAt);
      expect(queuedItems.time_updated).toEqual(testEventBody.updatedAt);
      expect(queuedItems.prospect_id).toEqual(curatedItem.prospect_id);

      const prospectItem = await db(config.tables.curatedFeedProspects)
        .select()
        .where({
          prospect_id: curatedItem.prospect_id,
        })
        .first();

      expect(prospectItem.feed_id).toEqual(1);
      expect(prospectItem.resolved_id).toEqual(12345);
      expect(prospectItem.type).toBeNull();
      expect(prospectItem.curator).toEqual('sri');
      expect(prospectItem.status).toEqual('ready');
      expect(prospectItem.top_domain_id).toEqual(topDomainId);
      expect(prospectItem.time_added).toEqual(testEventBody.createdAt);
      expect(prospectItem.time_updated).toEqual(testEventBody.updatedAt);
      expect(prospectItem.prospect_id).toEqual(curatedItem.prospect_id);
      expect(prospectItem.title).toEqual(testEventBody.title);
      expect(prospectItem.excerpt).toEqual(testEventBody.excerpt);
      expect(prospectItem.image_src).toEqual(testEventBody.imageUrl);

      const tileSource = await db(config.tables.tileSource)
        .select()
        .where({
          source_id: curatedItemRecord?.curatedRecId,
        })
        .first();

      expect(tileSource.tile_id).toBeGreaterThan(0);
    }
    it('adds non-syndicated articles', async () => {
      nockParser(testEventBody);
      await addScheduledItem(testEventBody, db);
      await assertTables(testEventBody, db, 100);
    });

    it('adds syndicated articles with domainId from syndicated_articles table', async () => {
      const syndicatedTestEventBody = {
        ...testEventBody,
        isSyndicated: true,
        url: 'https://getpocket.com/explore/item/the-most-important-scientific-problems-have-yet-to-be-solved?utm_source=pocket-newtab',
      };

      nockParser(syndicatedTestEventBody);
      await addScheduledItem(syndicatedTestEventBody, db);
      await assertTables(syndicatedTestEventBody, db, 200);
    });

    it('should not call dynamo db write when the sql transaction fails', async () => {
      sinon.stub(DataService.prototype, 'insertTileSource').throws('sql error');
      const dymamoDbSpy = sinon.spy(
        CuratedItemRecordModel.prototype,
        'insertFromEvent'
      );
      nockParser(testEventBody);
      await expect(addScheduledItem(testEventBody, db)).rejects.toThrow(
        'failed to transact for the event body'
      );
      expect(dymamoDbSpy.callCount).toEqual(0);
    });
  });
});

function nockParser(testEventBody) {
  const parserData = { resolved_id: '12345', item: { domain_id: '123' } };
  const params = new URLSearchParams({
    output: 'regular',
    getItem: '1',
    images: '0',
    url: testEventBody.url,
  });

  nock(config.parserEndpoint).get('/').query(params).reply(200, parserData);
}
