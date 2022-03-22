import config from './config';
import * as Sentry from '@sentry/serverless';

export async function handlerFn(event: any) {
  Sentry.captureMessage(JSON.stringify(event));
  console.log(JSON.stringify(event));
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
