const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';
const defaultDb = 'readitla_ril-tmp';

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
    dbname: process.env.DATABASE_NAME || defaultDb,
    readSecretId: process.env.READ_DATABASE_SECRET_ID || '',
    writeSecretId: process.env.WRITE_DATABASE_SECRET_ID || '',
    port: process.env.DATABASE_PORT || '3310',
    tz: process.env.DATABASE_TZ || 'US/Central',
    deleteUserId: 21, // used for inserting deleted records in legacy audit table
    charset: 'utf8mb4',
  },
  tables: {
    curatedFeedProspects: `${defaultDb}.curated_feed_prospects`,
    curatedFeedQueuedItems: `${defaultDb}.curated_feed_queued_items`,
    curatedFeedItems: `${defaultDb}.curated_feed_items`,
    curatedFeedTopics: `${defaultDb}.curated_feed_topics`,
    tileSource: `${defaultDb}.tile_source`,
    syndicatedArticles: `${defaultDb}.syndicated_articles`,
    domains: 'readitla_b.domains',
    curatedFeedItemsDeleted: `${defaultDb}.curated_feed_items_deleted`,
  },
  parserEndpoint: process.env.PARSER_ENDPOINT || 'https://parser.getpocket.dev',
};
