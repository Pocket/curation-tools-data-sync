import { truncateDynamoDb } from '../dynamodb/dynamoUtilities';
import { dbClient } from '../dynamodb/dynamoDbClient';
import sinon from 'sinon';
import * as SecretManager from '../secretManager';
import { writeClient } from './dbClient';
import { Knex } from 'knex';
import { DataService } from './dataService';
import { CuratedFeedProspectItem } from '../types';
import config from '../config';

describe('database integration test', function () {
  //aim of this test is to validate knex integration and assumptions.
  //use cases will be tested in index.integration.ts
  let db: Knex;
  beforeAll(async () => {
    await truncateDynamoDb(dbClient);
    sinon.stub(SecretManager, 'getDbCredentials').resolves({
      readHost: 'localhost',
      readUsername: 'root',
      readPassword: '',
      writeHost: 'localhost',
      writeUsername: 'root',
      writePassword: '',
      port: '3310',
    });
    db = await writeClient();
    await db(config.tables.curatedFeedTopics).truncate();
    await db(config.tables.curatedFeedTopics).insert({
      topic_id: 1,
      name: 'Health & Fitness',
      status: 'live',
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
    expect(topicID).toEqual(1);
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

    expect(generatedProspectId).toBeGreaterThan(0);
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

    expect(generatedProspectId).toBeGreaterThan(0);
    const response = await db('curated_feed_prospects')
      .select('title')
      .where({
        prospect_id: generatedProspectId,
      })
      .first();

    expect(response['title']).toEqual('changed title');
  });
});
