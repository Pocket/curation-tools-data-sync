import { truncateDynamoDb } from '../dynamodb/dynamoUtilities';
import { dbClient } from '../dynamodb/dynamoDbClient';
import sinon from 'sinon';
import { expect } from 'chai';
import * as SecretManager from '../secretManager';
import { writeClient } from './dbClient';
import { Knex } from 'knex';
import { DataService } from './dataService';
import {
  ScheduledItemPayload,
  CuratedFeedProspectItem,
  EventDetailType,
} from '../types';
import config from '../config';

describe('database integration test', function () {
  //aim of this test is to validate knex integration and assumptions.
  //use cases will be tested in index.integration.ts
  let db: Knex;
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
    topic: 'HEALTH_FITNESS',
    isSyndicated: false,
    createdAt: 1648593897,
    createdBy: 'ad|Mozilla-LDAP|sri',
    updatedAt: 1648593897,
    scheduledSurfaceGuid: 'NEW_TAB_EN_US',
    scheduledDate: '2022-03-25',
  };

  beforeAll(async () => {
    await truncateDynamoDb(dbClient);
    sinon.stub(SecretManager, 'getDbCredentials').resolves({
      host: 'localhost',
      username: 'root',
      password: '',
      port: config.db.port,
    });
    db = await writeClient();
    await db(config.tables.curatedFeedTopics).truncate();
    await db(config.tables.curatedFeedTopics).insert({
      topic_id: 1,
      name: 'Health & Fitness',
      status: 'live',
    });
    await db(config.tables.domains).truncate();
    await db(config.tables.domains).insert({
      domain_id: 1,
      domain: 'nytimes.com',
      top_domain_id: 4,
    });
  });

  afterAll(async () => {
    await truncateDynamoDb(dbClient);
    await db.destroy();
    sinon.restore();
  });

  it('gets topicId for a name', async () => {
    const topicID = await new DataService(db).getTopicIdByName(
      'Health & Fitness'
    );
    expect(topicID).equals(1);
  });

  it('retrives prospectId after successfully inserting prospectItem', async () => {
    const prospectItem: CuratedFeedProspectItem = {
      feed_id: 3,
      resolved_id: 12345,
      type: null,
      status: 'ready',
      curator: 'cohara',
      time_added: 163243243,
      time_updated: 163243243,
      top_domain_id: 123,
      title: 'test title',
      excerpt: 'test excerpt',
      image_src: 's3://image_url',
      prospect_id: 0,
    };

    let generatedProspectId = -1;

    await db.transaction(async (trx) => {
      generatedProspectId = await new DataService(
        db
      ).insertCuratedFeedProspectItem(trx, prospectItem);
    });

    expect(generatedProspectId).to.be.greaterThan(0);
  });

  it('duplicate records need to merge and not throw error', async () => {
    const prospectItem: CuratedFeedProspectItem = {
      feed_id: 6,
      resolved_id: 4567,
      type: null,
      status: 'ready',
      curator: 'cohara',
      time_added: 163243243,
      time_updated: 163243243,
      top_domain_id: 123,
      title: 'test title',
      excerpt: 'test excerpt',
      image_src: 's3://image_url',
      prospect_id: 0,
    };
    let generatedProspectId;

    await db.transaction(async (trx) => {
      await new DataService(db).insertCuratedFeedProspectItem(
        trx,
        prospectItem
      );
    });

    prospectItem.title = 'changed title';

    await db.transaction(async (trx) => {
      generatedProspectId = await new DataService(
        db
      ).insertCuratedFeedProspectItem(trx, prospectItem);
    });

    expect(generatedProspectId).to.be.greaterThan(0);
    const response = await db('curated_feed_prospects')
      .select('title')
      .where({
        prospect_id: generatedProspectId,
      })
      .first();

    expect(response['title']).equals('changed title');
  });

  it('should rollback transaction if one of the database inserts fails', async () => {
    const dataService = new DataService(db);
    sinon.stub(dataService, 'insertTileSource').callsFake(fakeTileSource);
    const priorCuratedItem = await db(config.tables.curatedFeedItems).select();
    const priorProspectItem = await db(
      config.tables.curatedFeedProspects
    ).select();
    const priorQueuedItem = await db(
      config.tables.curatedFeedQueuedItems
    ).select();

    try {
      await dataService.addScheduledItem(testEventBody, 1, '1');
    } catch (e) {
      //do nothing
    }

    const curatedItem = await db(config.tables.curatedFeedItems).select();
    const prospectItem = await db(config.tables.curatedFeedProspects).select();
    const queuedItem = await db(config.tables.curatedFeedQueuedItems).select();

    expect(curatedItem).to.deep.equals(priorCuratedItem);
    expect(prospectItem).to.deep.equals(priorProspectItem);
    expect(queuedItem).to.deep.equals(priorQueuedItem);
  });
});

async function fakeTileSource() {
  throw new Error('sql error');
}
