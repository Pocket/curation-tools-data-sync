import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
//import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { BackfillMessage } from './types';
//import { hydrateCorpusInput, sleep } from './lib';
//import { callImportMutation } from './externalCaller/importMutationCaller';
/**
 * Lambda handler function. Separated from the Sentry wrapper
 * to make unit-testing easier.
 * Takes event from cloudwatch to initiatie the migration
 */
export async function handlerFn(event: SQSEvent): Promise<SQSBatchResponse> {
  // Not using map since we want to block after each record
  const batchFailures: SQSBatchItemFailure[] = [];
  let curatedRecId;
  let resolvedUrl;
  let imageUrl;
  let resolvedId;
  for await (const record of event.Records) {
    try {
      const message: BackfillMessage = JSON.parse(record.body);
      console.log(message);
      //as json stringify could throw error in catch, which can cause entire batch failure
      // fetching this value in try, and using them in catch.
      // curatedRecId = message.curated_rec_id;
      // resolvedUrl = message.resolved_url;
      // resolvedId = message.resolved_id;
      // imageUrl = message.image_src;
      // const prospectData = await fetchProspectData(message.resolved_url);
      // const corpusInput = hydrateCorpusInput(message, prospectData);
      // // Wait a sec... don't barrage the api. We're just backfilling here.
      // await sleep(1000);
      // const importMutationResponse = await callImportMutation(corpusInput);
      // const curatedItemRecord: CuratedItemRecord = {
      //   curatedRecId: parseInt(message.curated_rec_id),
      //   scheduledItemExternalId:
      //     importMutationResponse?.data?.importApprovedCorpusItem.scheduledItem
      //       .externalId,
      //   approvedItemExternalId:
      //     importMutationResponse?.data?.importApprovedCorpusItem.approvedItem
      //       .externalId,
      //   scheduledSurfaceGuid:
      //     ScheduledSurfaceGuid[
      //       importMutationResponse?.data?.importApprovedCorpusItem.scheduledItem
      //         .scheduledSurfaceGuid
      //     ],
      //   lastUpdatedAt: new Date().getTime(),
      // };
      // console.log(`curatedItemRecord -> ${JSON.stringify(curatedItemRecord)}`);
      //
      // await insertCuratedItem(dbClient, curatedItemRecord);
    } catch (error) {
      console.log(`unable to process message -> curatedRecId: ${curatedRecId},
       resolvedUrl : ${resolvedUrl}, resolvedId: ${resolvedId} image_src: ${imageUrl}`);
      console.log(error);
      Sentry.captureException(error);
      Sentry.addBreadcrumb({
        message: `unable to process message -> curatedRecId: ${curatedRecId},
       resolvedUrl : ${resolvedUrl}, resolvedId: ${resolvedId} image_src: ${imageUrl}`,
      });
      batchFailures.push({ itemIdentifier: record.messageId });
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
