import config from './config';
import * as Sentry from '@sentry/serverless';
import { writeClient } from './database/dbClient';
import { EventBridgeEvent } from 'aws-lambda';
import { addScheduledItem } from './eventConsumer';
import { EventDetailType } from './types';

export async function handlerFn(event: EventBridgeEvent<any, any>) {
  console.log(event);
  const db = await writeClient();
  if (event['detail-type'] == EventDetailType.ADD_SCHEDULED_ITEM) {
    await addScheduledItem(event.detail, db);
  }
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
