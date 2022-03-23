import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { BackfillMessage } from './types';
import { hydrateCorpusInput, sleep } from './lib';
import { CuratedItemRecord, ScheduledSurfaceGuid } from './dynamodb/types';
import { callImportMutation } from './externalCaller/importMutationCaller';

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

      const importMutationResponse = await callImportMutation(corpusInput);
      const curatedItemRecord: CuratedItemRecord = {
        curatedRecId: parseInt(message.curated_rec_id),
        scheduledItemExternalId:
          importMutationResponse?.data?.importApprovedCuratedCorpusItem
            .scheduledItem.externalId,
        approvedItemExternalId:
          importMutationResponse?.data?.importApprovedCuratedCorpusItem
            .approvedItem.externalId,
        scheduledSurfaceGuid:
          ScheduledSurfaceGuid[
            importMutationResponse?.data?.importApprovedCuratedCorpusItem
              .scheduledItem.scheduledSurfaceGuid
          ],
        lastUpdatedAt: new Date().getTime(),
      };
      await console.log(`curatedItemRecord -> ${curatedItemRecord}`);

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
