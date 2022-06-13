import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { SqsBackfillMessage } from './types';
import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { parseAuthorsCsv } from './lib';
//import { sleep } from './lib';
//import { callUpdateMutation } from './externalCaller/importMutationCaller';
/**
 * Lambda handler function. Separated from the Sentry wrapper
 * to make unit-testing easier.
 * Takes event from cloudwatch to initiatie the migration
 */
export async function handlerFn(event: SQSEvent): Promise<SQSBatchResponse> {
  // Not using map since we want to block after each record
  const batchFailures: SQSBatchItemFailure[] = [];

  let externalId;
  let url;
  let title;
  let publisher;

  let publisherUsed;

  for await (const record of event.Records) {
    try {
      const message: SqsBackfillMessage = JSON.parse(record.body);
      console.log(message);

      externalId = message.externalId;
      url = message.url;
      title = message.title;
      publisher = message.publisher;

      const prospectData = await fetchProspectData(url);

      let authors = parseAuthorsCsv(prospectData.authors);

      publisherUsed = false;
      // if no valid authors were found, default to the publisher
      if (!authors.length) {
        authors = [
          {
            name: publisher,
            sortOrder: 1,
          },
        ];
        publisherUsed = true;
      }

      console.log('AUTHOR LOG \n', `${externalId} ${title} ${publisherUsed}`);
      // Wait a sec... don't barrage the api. We're just backfilling here.

      //await sleep(1000);

      //const mutationResponse = await callUpdateMutation({
      //  externalId,
      //  authors,
      //});

      // TODO: do something with the response...

      //

      // copy / pasta code below - keeping for reference for now

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
      console.warn(`unable to process message -> externalId: ${externalId},
       url : ${url}, title: ${title}, publisher: ${publisher}`);
      console.warn(error);

      Sentry.captureException(error);

      Sentry.addBreadcrumb({
        message: `unable to process message -> externalId: ${externalId},
       url : ${url}, title: ${title}, publisher: ${publisher}`,
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
