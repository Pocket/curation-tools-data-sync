import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import * as SecretManager from '../curation-migration-datasync/secretManager';
import sinon from 'sinon';
import { writeClient } from './database/dbClient';
import {
  ScheduledItemPayload,
  EventDetailType,
  CuratedFeedQueuedItems,
  CuratedFeedProspectItem,
  ApprovedItemPayload,
} from './types';
import nock from 'nock';
import config from './config';
import { Knex } from 'knex';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { DataService } from './database/dataService';
import { convertDateToTimestamp } from './helpers/dataTransformers';
import {
  addScheduledItem,
  removeScheduledItem,
  updatedApprovedItem,
} from './eventConsumer';

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
      readHost: 'localhost',
      readUsername: 'root',
      readPassword: '',
      writeHost: 'localhost',
      writeUsername: 'root',
      writePassword: '',
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

  describe('update-approved-item', () => {
    const testEventBody: ApprovedItemPayload = {
      eventType: EventDetailType.UPDATE_APPROVED_ITEM,
      approvedItemExternalId: 'random_approved_guid_2',
      url: 'https://bongo-cat.com/',
      title: 'Welcome to the internet',
      excerpt: null,
      language: null,
      publisher: 'Pocket blog',
      imageUrl: 'https://bongo-cat.com/collection/2',
      topic: 'PERSONAL_FINANCE',
      isSyndicated: false,
      createdAt: null,
      createdBy: 'ad|Mozilla-LDAP|sri',
      updatedAt: 1649194017,
    };

    const curatedRecordPriorUpdate = {
      curated_rec_id: 2,
      prospect_id: 10,
      feed_id: 9,
      queued_id: 12,
      resolved_id: 12345,
      status: 'live',
      time_added: 1649094016,
      time_updated: 1649094017,
      time_live: 1649094018,
    };

    const prospectPriorUpdate: CuratedFeedProspectItem = {
      curator: 'joy',
      excerpt: 'Tomorrow is a mystery',
      feed_id: curatedRecordPriorUpdate.feed_id,
      image_src: 'https://cool-cry.com/collections/3',
      resolved_id: curatedRecordPriorUpdate.resolved_id,
      status: 'ready',
      time_added: curatedRecordPriorUpdate.time_added,
      time_updated: curatedRecordPriorUpdate.time_updated,
      title: 'Yesterday is history',
      top_domain_id: 419,
      type: 'live',
      prospect_id: curatedRecordPriorUpdate.prospect_id,
    };

    const queuedItemPriorUpdate: CuratedFeedQueuedItems = {
      curator: 'joy',
      feed_id: curatedRecordPriorUpdate.feed_id,
      prospect_id: curatedRecordPriorUpdate.prospect_id,
      relevance_length: 'week',
      resolved_id: curatedRecordPriorUpdate.resolved_id,
      status: 'ready',
      time_added: curatedRecordPriorUpdate.time_added,
      time_updated: curatedRecordPriorUpdate.time_updated,
      topic_id: 1,
      weight: 1,
      queued_id: curatedRecordPriorUpdate.queued_id,
    };

    afterEach(async () => {
      await Promise.all(
        [
          config.tables.curatedFeedProspects,
          config.tables.curatedFeedQueuedItems,
          config.tables.curatedFeedItems,
          config.tables.curatedFeedTopics,
        ].map((table) => db(table).truncate())
      );
    });

    beforeEach(async () => {
      db = await writeClient();
      await Promise.all(
        [
          config.tables.curatedFeedProspects,
          config.tables.curatedFeedQueuedItems,
          config.tables.curatedFeedItems,
          config.tables.curatedFeedTopics,
          config.tables.domains,
        ].map((table) => db(table).truncate())
      );

      await db(config.tables.curatedFeedItems).insert(curatedRecordPriorUpdate);
      await db(config.tables.curatedFeedProspects).insert(prospectPriorUpdate);
      await db(config.tables.curatedFeedQueuedItems).insert(
        queuedItemPriorUpdate
      );

      await db(config.tables.curatedFeedTopics).insert({
        topic_id: 1,
        name: 'Self Improvement',
        status: 'live',
      });
      await db(config.tables.curatedFeedTopics).insert({
        topic_id: 2,
        name: 'Personal Finance',
        status: 'live',
      });
    });

    it('should update only fields set to not-null', async () => {
      await updatedApprovedItem(testEventBody, db);

      const prospectRecord = await db(config.tables.curatedFeedProspects)
        .where({ prospect_id: curatedRecordPriorUpdate.prospect_id })
        .first();

      const queuedItemRecord = await db(config.tables.curatedFeedQueuedItems)
        .where({ queued_id: curatedRecordPriorUpdate.queued_id })
        .first();

      assertForUpdateApprovedItems(
        testEventBody,
        prospectRecord,
        prospectPriorUpdate,
        queuedItemRecord
      );

      //curated_feed_items remains as it is.
      const curatedItem = await db(config.tables.curatedFeedItems)
        .where({ curated_rec_id: curatedRecordPriorUpdate.curated_rec_id })
        .first();
      expect(curatedItem).toEqual(curatedRecordPriorUpdate);
    });

    it('should update all the curated_rec_id mapped with the approvedItem', async () => {
      //inserting another item in dynamo that has same approvedItem id.
      const curatedItemRecord: CuratedItemRecord = {
        curatedRecId: 3,
        scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
        scheduledItemExternalId: 'random_scheduled_guid_3',
        approvedItemExternalId: 'random_approved_guid_2',
        lastUpdatedAt: timestamp1,
      };
      await curatedRecordModel.insert(curatedItemRecord);

      //populating the second item that matches with the same random_approved_guid_2
      const curatedRecordPriorUpdate_2 = {
        curated_rec_id: 3,
        prospect_id: 11,
        feed_id: 1,
        queued_id: 11,
        resolved_id: curatedRecordPriorUpdate.resolved_id,
        status: 'live',
        time_added: 1649094016,
        time_updated: 1649000016,
        time_live: 1649000018,
      };

      const prospectItemPriorUpdate_2: CuratedFeedProspectItem = {
        curator: 'joy',
        excerpt: 'Tomorrow is a mystery',
        feed_id: curatedRecordPriorUpdate_2.feed_id,
        image_src: 'https://cool-cry.com/collections/3',
        resolved_id: curatedRecordPriorUpdate_2.resolved_id,
        status: 'ready',
        time_added: curatedRecordPriorUpdate_2.time_added,
        time_updated: curatedRecordPriorUpdate_2.time_updated,
        title: 'Yesterday is history',
        top_domain_id: 419,
        type: 'live',
        prospect_id: curatedRecordPriorUpdate_2.prospect_id,
      };

      const queuedItemPriorUpdate_2: CuratedFeedQueuedItems = {
        curator: 'joy',
        feed_id: curatedRecordPriorUpdate_2.feed_id,
        prospect_id: curatedRecordPriorUpdate_2.prospect_id,
        relevance_length: 'week',
        resolved_id: curatedRecordPriorUpdate_2.resolved_id,
        status: 'ready',
        time_added: curatedRecordPriorUpdate_2.time_added,
        time_updated: curatedRecordPriorUpdate_2.time_updated,
        topic_id: 1,
        weight: 1,
        queued_id: curatedRecordPriorUpdate_2.queued_id,
      };
      await db(config.tables.curatedFeedItems).insert(
        curatedRecordPriorUpdate_2
      );
      await db(config.tables.curatedFeedProspects).insert(
        prospectItemPriorUpdate_2
      );
      await db(config.tables.curatedFeedQueuedItems).insert(
        queuedItemPriorUpdate_2
      );

      await updatedApprovedItem(testEventBody, db);

      const prospectRecord = await db(config.tables.curatedFeedProspects)
        .where({ prospect_id: curatedRecordPriorUpdate.prospect_id })
        .first();

      const queuedItemRecord = await db(config.tables.curatedFeedQueuedItems)
        .where({ queued_id: curatedRecordPriorUpdate.queued_id })
        .first();
      const prospectRecord_2 = await db(config.tables.curatedFeedProspects)
        .where({ prospect_id: curatedRecordPriorUpdate_2.prospect_id })
        .first();
      const queuedItemRecord_2 = await db(config.tables.curatedFeedQueuedItems)
        .where({ queued_id: curatedRecordPriorUpdate_2.queued_id })
        .first();

      assertForUpdateApprovedItems(
        testEventBody,
        prospectRecord,
        prospectPriorUpdate,
        queuedItemRecord
      );

      assertForUpdateApprovedItems(
        testEventBody,
        prospectRecord_2,
        prospectPriorUpdate,
        queuedItemRecord_2
      );

      //curated_feed_items remains as it is.
      const curatedItem = await db(config.tables.curatedFeedItems)
        .where({ curated_rec_id: curatedRecordPriorUpdate.curated_rec_id })
        .first();
      const curatedItem_2 = await db(config.tables.curatedFeedItems)
        .where({ curated_rec_id: curatedRecordPriorUpdate_2.curated_rec_id })
        .first();
      expect(curatedItem).toEqual(curatedRecordPriorUpdate);
      expect(curatedItem_2).toEqual(curatedRecordPriorUpdate_2);
    });

    it('should ignore the event if approvedItem is not found in the dynamo', async () => {
      testEventBody.approvedItemExternalId = 'non-existent-approved-id';
      await updatedApprovedItem(testEventBody, db);
      const prospectRecord = await db(config.tables.curatedFeedProspects)
        .where({ prospect_id: curatedRecordPriorUpdate.prospect_id })
        .first();
      const queuedItem = await db(config.tables.curatedFeedQueuedItems)
        .where({ queued_id: curatedRecordPriorUpdate.queued_id })
        .first();
      const curatedItem = await db(config.tables.curatedFeedItems)
        .where({ curated_rec_id: curatedRecordPriorUpdate.curated_rec_id })
        .first();

      //none of the records in the database should have changed.
      expect(curatedItem).toEqual(curatedRecordPriorUpdate);
      expect(queuedItem).toEqual(queuedItemPriorUpdate);
      expect(prospectRecord).toEqual(prospectPriorUpdate);
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

function assertForUpdateApprovedItems(
  testEventBody,
  prospectRecord,
  prospectPriorUpdate,
  queuedItemRecord
) {
  expect(prospectRecord.title).toEqual(testEventBody.title);
  expect(prospectRecord.time_updated).toEqual(testEventBody.updatedAt);
  expect(prospectRecord.image_src).toEqual(testEventBody.imageUrl);
  //points to personal_finance
  expect(queuedItemRecord.topic_id).toEqual(2);
  expect(prospectRecord.curator).toEqual('sri');

  //records set as null in the event body should not be changed
  expect(prospectRecord.excerpt).toEqual(prospectPriorUpdate.excerpt);
  expect(prospectRecord.time_added).toEqual(prospectPriorUpdate.time_added);
  expect(prospectRecord.top_domain_id).toEqual(419);
  expect(queuedItemRecord.curator).toEqual(prospectRecord.curator);
  expect(queuedItemRecord.time_updated).toEqual(prospectRecord.time_updated);
}
