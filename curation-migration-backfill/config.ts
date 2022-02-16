const environment = process.env.ENVIRONMENT || 'development';
const isDev = environment === 'development';

const config = {
  app: {
    name: 'Curation-Migration-Backfill-Lambda',
    environment: environment,
    sentry: {
      // these values are inserted into the environment in
      // .aws/src/sqsLambda.ts
      dsn: process.env.SENTRY_DSN || '',
      release: process.env.GIT_SHA || '',
    },
  },
  aws: {
    region: process.env.REGION || 'us-east-1',
  },
  // AdminApi: isDev
  //   ? process.env.CLIENT_API_URI || 'https://client-api.getpocket.dev'
  //   : process.env.CLIENT_API_URI || 'https://client-api.readitlater.com',
  AdminApi: `https://admin-api.getpocket.dev`,
};

export default config;
