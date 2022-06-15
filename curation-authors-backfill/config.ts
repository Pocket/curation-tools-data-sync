const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';

const config = {
  app: {
    name: 'Curation-Migration-Author-Lambda',
    environment: environment,
    sentry: {
      // these values are inserted into the environment in
      // .aws/src/.ts
      dsn: process.env.SENTRY_DSN || '',
      release: process.env.GIT_SHA || '',
    },
  },
  aws: {
    localEndpoint: process.env.AWS_ENDPOINT,
    region: process.env.REGION || 'us-east-1',
  },
  AdminApi: isDev
    ? process.env.CLIENT_API_URI || 'https://admin-api.getpocket.dev'
    : process.env.CLIENT_API_URI || 'https://admin-api.getpocket.com',
  jwt: {
    key: process.env.JWT_KEY || 'CurationToolsDataSync/Dev/JWT_KEY',
    iss: process.env.JWT_ISS || 'https://getpocket.com',
    aud: process.env.JWT_AUD || 'https://admin-api.getpocket.com/',
    name: 'B. Ackfil User',
    userId: 'backfill-user',
    groups: ['mozilliansorg_pocket_scheduled_surface_curator_full'],
  },
};

export default config;
