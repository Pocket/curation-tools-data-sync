import config from './config';
import * as Sentry from '@sentry/serverless';
import { readClient, writeClient } from './dbClient';

export async function handlerFn(event: any) {
  console.log(JSON.stringify(event));
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
  // TODO: INFRA-401
  // update-approved-item events will not have scheduledSurfaceGuid; this
  // validation must be performed when checking to see if the underlying
  // approved item in the event is scheduled

  const readQuery = await (await readClient()).raw("SELECT 'Are we good?'");
  const writeQuery = await (
    await writeClient()
  ).raw("SELECT 'And we are lit!'");
  console.log('read for me:', readQuery[0], 'pretend to write:', writeQuery[0]);
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
