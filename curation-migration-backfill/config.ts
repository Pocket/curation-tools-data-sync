const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';

const config = {
  app: {
    name: 'Curation-Migration-Backfill-Lambda',
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
  },
  AdminApi: isDev
    ? process.env.CLIENT_API_URI || 'https://admin-api.getpocket.dev'
    : process.env.CLIENT_API_URI || 'https://admin-api.readitlater.com',
};

export default config;
