const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';

const config = {
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
    secretId: process.env.DATABASE_SECRET_ID || '',
    port: process.env.DATABASE_PORT || '3310',
    dbName: process.env.DATABASE || 'readitla_ril-tmp',
    tz: process.env.DATABASE_TZ || 'US/Central',
  },
  parserEndpoint: process.env.PARSER_ENDPOINT || 'http://parser.getpocket.dev',
};

export default config;
