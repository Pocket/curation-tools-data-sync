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
};

export default config;
