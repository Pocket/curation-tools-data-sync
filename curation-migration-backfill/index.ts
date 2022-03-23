import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { backOff } from 'exponential-backoff';
import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { importApprovedCuratedCorpusItem } from './externalCaller/curatedCorpusApiCaller';
import { BackfillMessage, CorpusInput } from './types';
import { hydrateCorpusInput, sleep } from './lib';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';

/**
 * Function that establishes the number of back off attempts
 * and calls the importApprovedCuratedCorpusItem function. Catches and throws any errors
 * as well as errors thrown by the mutation call
 */
export async function callImportMutation(data: CorpusInput) {
  // we've set the default number of retries to 3
  const backOffOptions = {
    numOfAttempts: 3,
  };

  let res: any;

  try {
    // call our mutation function
    res = await backOff(
      () => importApprovedCuratedCorpusItem(data),
      backOffOptions
    );
    if (res.errors != null) {
      throw new Error(
        `Failed to retrieve data from curated-corpus-api.\n GraphQL Errors: ${JSON.stringify(
          res.errors
        )}`
      );
    }
  } catch (e) {
    throw new Error(e);
  }
  return res;
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

      // Call the import mutation
      const importMutationResponse = await callImportMutation(corpusInput);
      console.log(`===========` + JSON.stringify(importMutationResponse));
      console.log(
        `****` +
          JSON.stringify(
            importMutationResponse?.data?.importApprovedCuratedCorpusItem
              .scheduledItem.externalId
          )
      );
      // const curatedItemRecord: CuratedItemRecord = {
      //   curatedRecId: parseInt(message.curated_rec_id),
      //   scheduledItemExternalId:
      //     importMutationResponse?.data?.importApprovedCuratedCorpusItem
      //       .scheduledItem.externalId,
      //   approvedItemExternalId:
      //     importMutationResponse?.data?.importApprovedCuratedCorpusItem
      //       .approvedItem.externalId,
      //   scheduledSurfaceGuid:
      //     ScheduledSurfaceGuid[
      //       importMutationResponse.data?.approvedItem.scheduledSurfaceGuid
      //     ],
      //   lastUpdatedAt: 1234,
      // };
      // await console.log(`curatedItemRecord -> ${curatedItemRecord}`);

      //TODO: insert the importMutationResponse data into dynamo
      //dynamoInsert()

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
