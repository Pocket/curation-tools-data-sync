const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';

export const config = {
  isDev,
  app: {
    name: 'Curation-Migration-Datasync-Lambda',
    environment: environment,
    sentry: {
      // these values are inserted into the environment in
      // .aws/src/.ts
      dsn: process.env.SENTRY_DSN || '',
      release: process.env.GIT_SHA || '',
    },
    // Use this to add feeds to allowlist, e.g. 'NEW_TAB_EN_US'
    // only events for this scheduled surface will be processed
    allowedScheduledSurfaceGuids: process.env.ALLOW_FEEDS
      ? process.env.ALLOW_FEEDS.split(',')
      : ['SANDBOX'], // Default to the test feed
  },
  aws: {
    region: process.env.REGION || 'us-east-1',
    localEndpoint: process.env.AWS_ENDPOINT,
    dynamoDB: {
      curationMigrationTable:
        process.env.CURATION_MIGRATION_TABLE || 'curation_migration_table',
      curatedRecIdHashKey:
        process.env.CURATION_MIGRATION_TABLE_HASH_KEY || 'curatedRecId',
    },
    eventRule: {
      source: 'curation-migration-datasync',
    },
  },
  db: {
    readSecretId: process.env.READ_DATABASE_SECRET_ID || '',
    writeSecretId: process.env.WRITE_DATABASE_SECRET_ID || '',
    port: process.env.DATABASE_PORT || '3310',
    tz: process.env.DATABASE_TZ || 'US/Central',
    deleteUserId: 21, // used for inserting deleted records in legacy audit table
  },
  tables: {
    curatedFeedProspects: 'curated_feed_prospects',
    curatedFeedQueuedItems: 'curated_feed_queued_items',
    curatedFeedItems: 'curated_feed_items',
    curatedFeedTopics: 'curated_feed_topics',
    tileSource: 'tile_source',
    syndicatedArticles: 'syndicated_articles',
    domains: 'readitla_b.domains',
    curatedFeedItemsDeleted: 'curated_feed_items_deleted',
  },
  parserEndpoint: process.env.PARSER_ENDPOINT || 'http://parser.getpocket.dev',
};
