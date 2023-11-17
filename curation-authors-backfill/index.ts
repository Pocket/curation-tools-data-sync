import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { ApprovedItemAuthor, SqsBackfillMessage } from './types';
import { fetchProspectData } from './externalCaller/prospectApiCaller';
import { parseAuthorsCsv, sleep } from './lib';
import { callUpdateMutation } from './externalCaller/importMutationCaller';

// simple function to create a string representation of an array of author names and sort orders
// returns a string like "Jane Austin (1), Octavia Butler (2)"
function stringifyAuthors(authors: ApprovedItemAuthor[]): string {
  return authors.reduce((previous, current: ApprovedItemAuthor) => {
    return `${previous}, ${current.name} (${current.sortOrder})`;
  }, '');
}

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

      let prospectData;

      try {
        prospectData = await fetchProspectData(url);
      } catch (error) {
        throw new Error(
          `Failed to fetch prospect data from Parser. Reason: ${error}`,
        );
      }

      let authors: ApprovedItemAuthor[] = parseAuthorsCsv(prospectData.authors);

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

      console.log(
        `MUTATION INPUT: externalId: ${externalId}, publisher: ${publisher}, authors: ${stringifyAuthors(
          authors,
        )}`,
      );

      try {
        const { data } = await callUpdateMutation({
          externalId,
          authors,
        });
        console.log(
          `MUTATION OUTPUT: externalId: ${
            data.updateApprovedCorpusItemAuthors.externalId
          }, url: ${data.updateApprovedCorpusItemAuthors.url}, title: ${
            data.updateApprovedCorpusItemAuthors.title
          } authors: ${stringifyAuthors(
            data.updateApprovedCorpusItemAuthors.authors,
          )}`,
        );
      } catch (error) {
        throw new Error(
          `Update mutation call failed for item. Reason: ${error}`,
        );
      }

      // Run the `updateApprovedCorpusItemAuthors` mutation
    } catch (error) {
      console.warn(`unable to process message -> externalId: ${externalId},
       url : ${url}, title: ${title}, publisher: ${publisher}. Error: ${error}`);

      Sentry.captureException(error);

      Sentry.addBreadcrumb({
        message: `unable to process message -> externalId: ${externalId},
       url : ${url}, title: ${title}, publisher: ${publisher}. Error: ${error}`,
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
