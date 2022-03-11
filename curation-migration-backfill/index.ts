import * as Sentry from '@sentry/serverless';
import config from './config';
import {
  getByCuratedRecId,
  insertCuratedItem,
  truncateDb,
} from './dynamodb/dynamoUtilities';
import { dbClient } from './dynamodb/dynamoDbClient';
import { CuratedItemRecord } from './dynamodb/types';

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
  Sentry.captureMessage(`testing sentry -> ` + JSON.stringify(event));

  //todo: temp code to check dynamo-lamba integration, can be removed later.
  if (event == 'dynamo') {
    const itemToBeAdded: CuratedItemRecord = {
      curatedRecId: 10,
      scheduledSurfaceGuid: 'NEW_TAB_EN_US',
      scheduledItemExternalId: 'random-scheduled-guid-10',
      approvedItemExternalId: 'random-approved-guid-10',
      lastUpdatedAt: Math.round(new Date().getTime() / 1000),
    };
    await insertCuratedItem(dbClient, itemToBeAdded);
    const res: CuratedItemRecord = await getByCuratedRecId(dbClient, 10);
    console.log(res);
  }
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
