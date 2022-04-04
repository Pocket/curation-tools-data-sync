import config from './config';
import * as Sentry from '@sentry/serverless';
import { writeClient } from './database/dbClient';
import { EventBridgeEvent } from 'aws-lambda';
import { addScheduledItem, updatedApprovedItem } from './eventConsumer';
import { EventDetailType } from './types';

export async function handlerFn(event: EventBridgeEvent<any, any>) {
  console.log(JSON.stringify(event));
  const db = await writeClient();

  //only update-approved-item event will not have scheduledSurfaceGuid
  if (event['detail-type'] == EventDetailType.UPDATE_APPROVED_ITEM) {
    await updatedApprovedItem(event.detail, db);
    return;
  }

  // Check if the feed is included in the allowlist
  if (
    event.detail.scheduledSurfaceGuid &&
    !config.app.allowedScheduledSurfaceGuids.includes(
      event.detail.scheduledSurfaceGuid
    )
  ) {
    console.log(
      `Unhandled scheduledSurfaceGuid: ${event.detail.scheduledSurfaceGuid}. Skipping sync.`
    );
    return;
  }

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
