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
  tags: {
    service: name,
    environment,
  },
};
