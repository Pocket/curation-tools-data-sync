import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { SqsBackfillMessage } from './types';
import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { parseAuthorsCsv, sleep } from './lib';
import { callUpdateMutation } from './externalCaller/importMutationCaller';
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

      // if no valid authors were found, default to the publisher
      if (!authors.length) {
        authors = [
          {
            name: publisher,
            sortOrder: 1,
          },
        ];
      }

      // Wait a sec... don't barrage the API. We're just backfilling here.
      await sleep(1000);

      // Run the `updateApprovedCorpusItemAuthors` mutation
      await callUpdateMutation({
        externalId,
        authors,
      });
    } catch (error) {
      console.log(`unable to process message -> externalId: ${externalId},
       url : ${url}, title: ${title}, publisher: ${publisher}`);
      console.log(error);

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
