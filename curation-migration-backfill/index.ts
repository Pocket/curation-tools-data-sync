import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

import { backOff } from 'exponential-backoff';

import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { importApprovedCuratedCorpusItem } from './externalCaller/curatedCorpusApiCaller';
//import { ImportApprovedCuratedCorpusItemPayload } from './types';
import { BackfillMessage, CorpusInput, ProspectInfo } from './types';

import { hydrateCorpusInput, sleep } from './lib';

/**
 *
 */
export async function callImportMutation(data: CorpusInput) {
  const backOffOptions = {
    numOfAttempts: 3,
  };

  try {
    const res: any = await backOff(
      () => importApprovedCuratedCorpusItem(data),
      backOffOptions
    );
    if (res.statusCode == 200 && res.errors != null) {
      throw new Error(
        `Failed to retrieve data from curated-corpus-api.\n GraphQL Errors: ${JSON.stringify(
          res.errors
        )}`
      );
    }
  } catch (e) {
    throw new Error(e);
  }
}

/**
 * Lambda handler function. Separated from the Sentry wrapper
 * to make unit-testing easier.
 * Takes event from cloudwatch to initiatie the migration
 */
export async function handlerFn(event: SQSEvent): Promise<SQSBatchResponse> {
  // Not using map since we want to block after each record
  const batchFailures: SQSBatchItemFailure[] = [];
  for await (const record of event.Records) {
    try {
      const message: BackfillMessage = JSON.parse(record.body);
      const prospectData = await fetchProspectData(message.resolved_url);
      const corpusInput = hydrateCorpusInput(message, prospectData);
      // Wait a sec... don't barrage the api. We're just backfilling here.
      await sleep(1000);
      // TODO
      // Here's where you'd call the import mutation instead
      callImportMutation(corpusInput);

      console.log(corpusInput);
      // TODO
      // If the import succeeds, add mapping record to dynamodb
      // await createCuratedItem(corpusInput) // method does not yet exist; should hydrate object and call insertCuratedItem internally
    } catch (error) {
      batchFailures.push({ itemIdentifier: record.messageId });
      Sentry.captureException(error);
    }
  }
  return { batchItemFailures: batchFailures };
}

Sentry.AWSLambda.init({
  dsn: config.app.sentry.dsn,
  release: config.app.sentry.release,
  environment: config.app.environment,
  serverName: config.app.name,
});

export const handler = Sentry.AWSLambda.wrapHandler(handlerFn);
