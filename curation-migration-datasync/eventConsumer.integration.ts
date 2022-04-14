import * as Sentry from '@sentry/serverless';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { truncateDynamoDb } from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import * as SecretManager from './database/secretManager';
import sinon from 'sinon';
import { writeClient } from './database/dbClient';
import {
  ScheduledItemPayload,
  EventDetailType,
  CuratedFeedProspectItem,
  CuratedFeedQueuedItem,
  ApprovedItemPayload,
} from './types';
import nock from 'nock';
import { config } from './config';
import { Knex } from 'knex';
import { CuratedItemRecordModel } from './dynamodb/curatedItemRecordModel';
import { DataService } from './database/dataService';
import {
  convertDateToTimestamp,
  convertUtcStringToTimestamp,
} from './helpers/dataTransformers';
import {
  addScheduledItem,
  removeScheduledItem,
  updateScheduledItem,
  updateApprovedItem,
} from './eventConsumer';
import * as hydrator from './database/hydrator';
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
      dbname: 'readitla_ril-tmp',
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
        curatedRecordModel.upsert(item);
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
      {
        domain_id: 419,
        domain: 'https://bongo-cat.com',
        top_domain_id: 10,
      },
    ];
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
          eventType: EventDetailType.REMOVE_SCHEDULED_ITEM,
          scheduledItemExternalId: 'random_scheduled_guid_2',
          // other fields we don't need
        } as ScheduledItemPayload;
        await expect(removeScheduledItem(testEventBody, db)).rejects.toThrow(
          'No record found for curatedRecId'
        );
      });
      it('throws error if the scheduledItemExternalId is not present in dynamo map', async () => {
        const testEventBody = {
          eventType: EventDetailType.REMOVE_SCHEDULED_ITEM,
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
          eventType: EventDetailType.REMOVE_SCHEDULED_ITEM,
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
    const testEventBody: ScheduledItemPayload = {
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
      createdAt: 'Fri, 01 Apr 2022 21:55:15 GMT', //1648850115",
      createdBy: 'ad|Mozilla-LDAP|sri',
      updatedAt: 'Sat, 02 Apr 2022 21:55:15 GMT', //1648936515
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
      expect(curatedItem.time_added).toEqual(
        convertUtcStringToTimestamp(testEventBody.createdAt)
      );
      expect(curatedItem.time_updated).toEqual(
        convertUtcStringToTimestamp(testEventBody.updatedAt)
      );

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
      expect(queuedItems.time_added).toEqual(
        convertUtcStringToTimestamp(testEventBody.createdAt)
      );
      expect(queuedItems.time_updated).toEqual(
        convertUtcStringToTimestamp(testEventBody.updatedAt)
      );
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
      expect(prospectItem.status).toEqual('approved');
      expect(prospectItem.top_domain_id).toEqual(topDomainId);
      expect(prospectItem.time_added).toEqual(
        convertUtcStringToTimestamp(testEventBody.createdAt)
      );
      expect(prospectItem.time_updated).toEqual(
        convertUtcStringToTimestamp(testEventBody.updatedAt)
      );
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
    it('adds articles', async () => {
      nockParser(testEventBody);
      await addScheduledItem(testEventBody, db);
      await assertTables(testEventBody, db, 100);
    });

    it('should not call dynamo db write when the sql transaction fails', async () => {
      sinon.stub(DataService.prototype, 'insertTileSource').throws('sql error');
      const dymamoDbSpy = sinon.spy(
        CuratedItemRecordModel.prototype,
        'upsertFromEvent'
      );
      nockParser(testEventBody);
      await expect(addScheduledItem(testEventBody, db)).rejects.toThrow(
        'failed to transact for the event body'
      );
      expect(dymamoDbSpy.callCount).toEqual(0);
    });
  });

  describe('update-scheduled-item', () => {
    const testEventBody: ScheduledItemPayload = {
      eventType: EventDetailType.UPDATE_SCHEDULED_ITEM,
      scheduledItemExternalId: 'random_scheduled_guid_2',
      approvedItemExternalId: 'random_approved_guid_2',
      url: 'https://bongo-cat.com/',
      title: 'Welcome to the internet',
      excerpt: 'Anything and everything, all of the time',
      language: 'EN',
      publisher: 'Pocket blog',
      imageUrl: 'https://bongo-cat.com/collection/2',
      topic: 'SELF_IMPROVEMENT',
      isSyndicated: false,
      createdAt: 'Fri, 01 Apr 2022 21:55:15 GMT', //1648850115
      createdBy: 'ad|Mozilla-LDAP|kelvin',
      updatedAt: 'Sat, 02 Apr 2022 21:55:15 GMT', //1648936515
      scheduledSurfaceGuid: 'NEW_TAB_EN_US',
      scheduledDate: '2022-03-25',
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

    const prospect: CuratedFeedProspectItem = {
      curator: 'joy',
      excerpt: 'Tomorrow is a mystery',
      feed_id: 0,
      image_src: 'https://cool-cry.com/collections/3',
      resolved_id: 99,
      status: 'approved',
      time_added: 1649094016,
      time_updated: 1649094017,
      title: 'Yesterday is history',
      top_domain_id: 419,
      type: 'live',
      prospect_id: curatedRecord.prospect_id,
    };

    const queuedItem: CuratedFeedQueuedItem = {
      curator: 'joy',
      feed_id: 0,
      prospect_id: 10,
      relevance_length: 'week',
      resolved_id: 99,
      status: 'used',
      time_added: 1649094016,
      time_updated: 1649094017,
      topic_id: 1,
      weight: 1,
      queued_id: curatedRecord.queued_id,
    };

    const lastUpdatedAt = new Date('2022-04-05 00:00:00');
    let clock;
    beforeEach(() => {
      clock = sinon.useFakeTimers({
        now: lastUpdatedAt,
        shouldAdvanceTime: false,
      });
    });

    afterEach(async () => {
      await Promise.all(
        [
          config.tables.curatedFeedProspects,
          config.tables.curatedFeedQueuedItems,
          config.tables.curatedFeedItems,
        ].map((table) => db(table).truncate())
      );
      clock.restore();
    });

    describe('scheduledItemExternalId exists in DynamoDB', () => {
      beforeEach(async () => {
        await db(config.tables.curatedFeedItems).insert(curatedRecord);
        await db(config.tables.curatedFeedProspects).insert(prospect);
        await db(config.tables.curatedFeedQueuedItems).insert(queuedItem);

        nockParser(testEventBody);
      });

      it('updates the curated feed item and the associated curated feed records', async () => {
        await updateScheduledItem(testEventBody, db);

        const prospectRecord = await db(config.tables.curatedFeedProspects)
          .where({ prospect_id: curatedRecord.prospect_id })
          .first();
        expect(prospectRecord.title).toEqual(testEventBody.title);
        expect(prospectRecord.time_updated).toEqual(
          convertUtcStringToTimestamp(testEventBody.updatedAt)
        );

        const queuedItemRecord = await db(config.tables.curatedFeedQueuedItems)
          .where({ queued_id: curatedRecord.queued_id })
          .first();
        expect(queuedItemRecord.curator).toEqual(prospectRecord.curator);
        expect(queuedItemRecord.time_updated).toEqual(
          prospectRecord.time_updated
        );

        const curatedItem = await db(config.tables.curatedFeedItems)
          .where({ curated_rec_id: curatedRecord.curated_rec_id })
          .first();
        expect(curatedItem.resolved_id).toEqual(12345);
        expect(curatedItem.time_updated).toEqual(queuedItemRecord.time_updated);

        const curatedItemRecord =
          await curatedRecordModel.getByScheduledItemExternalId(
            'random_scheduled_guid_2'
          );
        expect(curatedItemRecord?.lastUpdatedAt).toEqual(
          Math.round(lastUpdatedAt.getTime() / 1000)
        );
      });

      it('rolls back updates if an error occurs before all tables are updated', async () => {
        sinon.stub(hydrator, 'hydrateCuratedFeedItem').throws('error');

        await expect(updateScheduledItem(testEventBody, db)).rejects.toThrow();

        const prospectRecord = await db(config.tables.curatedFeedProspects)
          .where({ prospect_id: curatedRecord.prospect_id })
          .first();
        expect(prospectRecord.resolved_id).toEqual(prospect.resolved_id);

        const queuedItemRecord = await db(config.tables.curatedFeedQueuedItems)
          .where({ queued_id: curatedRecord.queued_id })
          .first();
        expect(queuedItemRecord.resolved_id).toEqual(queuedItem.resolved_id);

        const curatedItemRecord = await db(config.tables.curatedFeedItems)
          .where({ curated_rec_id: curatedRecord.curated_rec_id })
          .first();
        expect(curatedItemRecord.resolved_id).toEqual(
          curatedRecord.resolved_id
        );
      });
    });

    it('adds the curated feed item and the associated curated feed records if mapping does not exist', async () => {
      const eventBody = {
        ...testEventBody,
        scheduledItemExternalId: 'faketh_not',
      };
      const resolvedId = 12345;
      const consoleSpy = sinon.spy(console, 'log');
      const sentrySpy = sinon.spy(Sentry, 'captureMessage');
      nockParser(eventBody);
      await updateScheduledItem(eventBody, db);

      const prospect = await db(config.tables.curatedFeedProspects)
        .where({ resolved_id: resolvedId })
        .first();
      expect(prospect).not.toBeUndefined();

      const queuedItem = await db(config.tables.curatedFeedQueuedItems)
        .where({ resolved_id: resolvedId })
        .first();
      expect(queuedItem).not.toBeUndefined();

      const curatedItem = await db(config.tables.curatedFeedItems)
        .where({ resolved_id: resolvedId })
        .first();
      expect(curatedItem.queued_id).toEqual(queuedItem.queued_id);
      expect(curatedItem.prospect_id).toEqual(prospect.prospect_id);

      const scheduledItemRecord =
        await curatedRecordModel.getByScheduledItemExternalId(
          eventBody.scheduledItemExternalId
        );
      expect(scheduledItemRecord).not.toBeUndefined();

      const errorMessage =
        'update-scheduled-item: No mapping found for scheduledItemExternalId=faketh_not';
      sinon.assert.calledWith(consoleSpy, errorMessage);
      sinon.assert.calledWith(sentrySpy, errorMessage);
    });
  });

  describe('update-approved-item', () => {
    const testEventBody: ApprovedItemPayload = {
      eventType: EventDetailType.UPDATE_APPROVED_ITEM,
      approvedItemExternalId: 'random_approved_guid_2',
      url: 'https://bongo-cat.com/',
      title: 'Welcome to the internet',
      //excerpt: undefined,
      language: null,
      publisher: 'Pocket blog',
      imageUrl: 'https://bongo-cat.com/collection/2',
      //topic: 'PERSONAL_FINANCE',
      isSyndicated: false,
      createdAt: null,
      createdBy: 'ad|Mozilla-LDAP|sri',
      updatedAt: 'Mon, 04 Apr 2022 21:55:15 GMT', //1649194017,
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
      status: 'approved',
      time_added: curatedRecordPriorUpdate.time_added,
      time_updated: curatedRecordPriorUpdate.time_updated,
      title: 'Yesterday is history',
      top_domain_id: 419,
      type: 'live',
      prospect_id: curatedRecordPriorUpdate.prospect_id,
    };

    const queuedItemPriorUpdate: CuratedFeedQueuedItem = {
      curator: 'joy',
      feed_id: curatedRecordPriorUpdate.feed_id,
      prospect_id: curatedRecordPriorUpdate.prospect_id,
      relevance_length: 'week',
      resolved_id: curatedRecordPriorUpdate.resolved_id,
      status: 'used',
      time_added: curatedRecordPriorUpdate.time_added,
      time_updated: curatedRecordPriorUpdate.time_updated,
      topic_id: 1,
      weight: 1,
      queued_id: curatedRecordPriorUpdate.queued_id,
    };

    afterEach(async () => {
      jest.clearAllMocks();
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
      await updateApprovedItem(testEventBody, db);

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
        queuedItemRecord,
        queuedItemPriorUpdate.topic_id
      );

      //curated_feed_items remains as it is.
      const curatedItem = await db(config.tables.curatedFeedItems)
        .where({ curated_rec_id: curatedRecordPriorUpdate.curated_rec_id })
        .first();
      expect(curatedItem).toEqual(curatedRecordPriorUpdate);
    });

    it('should update all the curated_rec_id mapped with the approvedItem', async () => {
      testEventBody.topic = 'PERSONAL_FINANCE';

      //inserting another item in dynamo that has same approvedItem id.
      const curatedItemRecord: CuratedItemRecord = {
        curatedRecId: 3,
        scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
        scheduledItemExternalId: 'random_scheduled_guid_3',
        approvedItemExternalId: 'random_approved_guid_2',
        lastUpdatedAt: timestamp1,
      };
      await curatedRecordModel.upsert(curatedItemRecord);

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
        status: 'approved',
        time_added: curatedRecordPriorUpdate_2.time_added,
        time_updated: curatedRecordPriorUpdate_2.time_updated,
        title: 'Yesterday is history',
        top_domain_id: 419,
        type: 'live',
        prospect_id: curatedRecordPriorUpdate_2.prospect_id,
      };

      const queuedItemPriorUpdate_2: CuratedFeedQueuedItem = {
        curator: 'joy',
        feed_id: curatedRecordPriorUpdate_2.feed_id,
        prospect_id: curatedRecordPriorUpdate_2.prospect_id,
        relevance_length: 'week',
        resolved_id: curatedRecordPriorUpdate_2.resolved_id,
        status: 'used',
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

      await updateApprovedItem(testEventBody, db);

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
        queuedItemRecord,
        2 //personal finance id
      );

      assertForUpdateApprovedItems(
        testEventBody,
        prospectRecord_2,
        prospectPriorUpdate,
        queuedItemRecord_2,
        2 // personal finance id
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

    it('should log error if curated_rec_id is not found in the database', async () => {
      //inserting item that will not be in the database
      const consoleSpy = jest.spyOn(console, 'log');
      const nonExistentId = 10;
      const curatedItemRecord: CuratedItemRecord = {
        curatedRecId: nonExistentId,
        scheduledSurfaceGuid: ScheduledSurfaceGuid.NEW_TAB_EN_GB,
        scheduledItemExternalId: 'random_scheduled_guid_4',
        approvedItemExternalId: 'random_approved_guid_2',
        lastUpdatedAt: timestamp1,
      };
      await curatedRecordModel.upsert(curatedItemRecord);
      await updateApprovedItem(testEventBody, db);
      expect(consoleSpy.mock.calls.length).toEqual(1);
      await curatedRecordModel.deleteByCuratedRecId(nonExistentId);
    });

    it('should ignore the event if approvedItem is not found in the dynamo', async () => {
      testEventBody.approvedItemExternalId = 'non-existent-approved-id';
      await updateApprovedItem(testEventBody, db);
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
  queuedItemRecord,
  topicId
) {
  expect(prospectRecord.title).toEqual(testEventBody.title);
  expect(prospectRecord.time_updated).toEqual(
    convertUtcStringToTimestamp(testEventBody.updatedAt)
  );
  expect(prospectRecord.image_src).toEqual(testEventBody.imageUrl);
  //points to personal_finance
  expect(queuedItemRecord.topic_id).toEqual(topicId);
  expect(prospectRecord.curator).toEqual('sri');

  //records set as null in the event body should not be changed
  expect(prospectRecord.excerpt).toEqual(prospectPriorUpdate.excerpt);
  expect(prospectRecord.time_added).toEqual(prospectPriorUpdate.time_added);
  expect(prospectRecord.top_domain_id).toEqual(419);
  expect(queuedItemRecord.curator).toEqual(prospectRecord.curator);
  expect(queuedItemRecord.time_updated).toEqual(prospectRecord.time_updated);
  expect(queuedItemRecord.time_added).toEqual(prospectRecord.time_added);
}
