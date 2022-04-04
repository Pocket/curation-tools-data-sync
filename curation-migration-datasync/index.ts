import config from './config';
import * as Sentry from '@sentry/serverless';
import { writeClient } from './database/dbClient';
import {
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
  EventBridgeEvent,
} from 'aws-lambda';
import { addScheduledItem, removeScheduledItem } from './eventConsumer';
import { EventDetailType, ScheduledItemPayload } from './types';

/**
 * Handler entrypoint. Loops over every record in the message and calls
 * the function logic to handle the record. Reports the batch failures
 * (partial success is possible).
 * @param event the SQS message
 * @returns the batch failures, if any
 */
export async function handlerFn(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchFailures: SQSBatchItemFailure[] = [];
  for await (const record of event.Records) {
    const message = JSON.parse(record.body);
    console.log(message); // TODO: Remove this later
    try {
      await _handlerFn(message);
    } catch (error) {
      batchFailures.push({ itemIdentifier: record.messageId });
      console.log(error);
      Sentry.addBreadcrumb({
        message: `Unable to process message: ${record.body}`,
      });
      Sentry.captureException(error);
    }
  }
  return { batchItemFailures: batchFailures };
}

/**
 * Handler function for a single record on an SQS message. This function
 * actually performs the logic for processing the event.
 */
async function _handlerFn(
  eventBody: EventBridgeEvent<EventDetailType, ScheduledItemPayload>
): Promise<void> {
  // Check if the feed is included in the allowlist
  if (
    eventBody.detail.scheduledSurfaceGuid &&
    !config.app.allowedScheduledSurfaceGuids.includes(
      eventBody.detail.scheduledSurfaceGuid
    )
  ) {
    console.log(
      `Unhandled scheduledSurfaceGuid: ${eventBody.detail.scheduledSurfaceGuid}. Skipping sync.`
    );
    return;
  }
  // TODO: INFRA-401
  // update-approved-item events will not have scheduledSurfaceGuid; this
  // validation must be performed when checking to see if the underlying
  // approved item in the event is scheduled

  const db = await writeClient();
  if (eventBody['detail-type'] === EventDetailType.ADD_SCHEDULED_ITEM) {
    await addScheduledItem(eventBody.detail, db);
  }
  if (eventBody['detail-type'] === EventDetailType.DELETE_SCHEDULED_ITEM) {
    await removeScheduledItem(eventBody.detail, db);
  }
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
