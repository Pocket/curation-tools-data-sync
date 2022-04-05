const name = 'CurationToolsDataSync';
const domainPrefix = 'curation-tools-data-sync';
const isDev = process.env.NODE_ENV === 'development';
const environment = isDev ? 'Dev' : 'Prod';

export const config = {
  name,
  isDev,
  domainPrefix,
  prefix: `${name}-${environment}`,
  circleCIPrefix: `/${name}/CircleCI/${environment}`,
  shortName: 'CTSYNC',
  environment,
  rds: {
    minCapacity: 1,
    maxCapacity: isDev ? 1 : undefined,
  },
  tags: {
    service: name,
    environment,
  },
  datasyncLambda: {
    dbName: 'readitla_ril-tmp',
    readDbSecretId: `${name}/${environment}/READITLA_DATABASE_READ`, // For production; in dev, uses the generated secret for RDS instead
    writeDbSecretId: `${name}/${environment}/READITLA_DATABASE_WRITE`, // For production; in dev, uses the generated secret for RDS instead
    allowFeeds: 'SANDBOX', // comma-separated list of scheduledSurfaceGUID to sync
  },
};
