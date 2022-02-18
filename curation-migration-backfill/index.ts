import * as Sentry from '@sentry/serverless';
import config from './config';
import { readFromS3 } from './s3Client';

export enum EVENT {
  CURATION_MIGRATION_BACKFILL = 'curation-migration-backfill',
}

/**
 * Lambda handler function. Separated from the Sentry wrapper
 * to make unit-testing easier.
 * Takes event from cloudwatch to initiatie the migration
 */
export async function handlerFn(event: any) {
  console.log(JSON.stringify(event));
  await readFromS3();
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
