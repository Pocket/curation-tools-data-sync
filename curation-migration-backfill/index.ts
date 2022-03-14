import * as Sentry from '@sentry/serverless';
import config from './config';
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import fetch from 'node-fetch';

export enum EVENT {
  CURATION_MIGRATION_BACKFILL = 'curation-migration-backfill',
}

interface BackfillMessage {
  curated_rec_id: string;
  time_live: number;
  time_added: number;
  time_updated: number;
  title: string;
  excerpt: string;
  curator: string | null;
  image_src: string;
  resolved_id: number;
  resolved_url: string;
  lang: string;
  topic_name: string | null;
  feed_id: number;
  slug: string;
}

interface CorpusInput {
  url: string;
  title: string;
  excerpt: string;
  status: 'RECOMMENDATION'; // ?
  language: string;
  publisher: string;
  imageUrl: string;
  topic: string | null;
  source: 'BACKFILL';
  isCollection: boolean;
  isSyndicated: boolean;
  createdAt: number;
  createdBy: string | null;
  updatedAt: number;
  updatedBy: string | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledSurfaceGuid: string;
}

// ୧༼ ಠ益ಠ ༽୨  aws and their old node runtimes
const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

type ProspectInfo = Pick<
  CorpusInput,
  'isCollection' | 'isSyndicated' | 'publisher'
>;

// Some data mappings
const feedIdToGuid = {
  1: 'NEW_TAB_EN_US',
  3: 'NEW_TAB_DE_DE',
  6: 'NEW_TAB_EN_GB',
  8: 'NEW_TAB_EN_INTL',
};

const ssoPrefix = 'ad|Mozilla-LDAP|';

/**
 * Convert epoch to UTC date (YYYY-MM-DD).
 */
export function epochToDateString(epoch: number): string {
  const date = new Date(epoch * 1000);
  const month = date.getUTCMonth() + 1; // zero-indexed
  const padMonthString = month.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${padMonthString}-${date.getUTCDate()}`;
}

async function hydrateCorpusInput(
  record: BackfillMessage
): Promise<CorpusInput> {
  const prospectData = await fetchProspectData(record.resolved_url);
  const curator = record.curator ? `${ssoPrefix}${record.curator}` : 'unknown';
  const corpusInput = {
    url: record.resolved_url,
    title: record.title,
    excerpt: record.excerpt,
    status: 'RECOMMENDATION' as const,
    language: record.lang,
    imageUrl: record.image_src,
    topic: record.topic_name,
    source: 'BACKFILL' as const,
    createdAt: record.time_added,
    updatedAt: record.time_added, // dropping time_updated since we don't know updatedBy
    createdBy: curator,
    updatedBy: curator,
    scheduledDate: epochToDateString(record.time_live),
    scheduledSurfaceGuid: feedIdToGuid[record.feed_id],
    ...prospectData,
  };
  return corpusInput;
}

/**
 * Retrieve metadata from prospect-api request
 * @param url the URL key for retrieving metadata from prospect-api
 * @returns Promise<ProspectInfo>
 */
async function fetchProspectData(url: string): Promise<ProspectInfo> {
  const query = `
  query getUrlMetadata($url: String!) {
    getUrlMetadata(url: $url) {
      isSyndicated
      isCollection
      publisher
    }
  }
  `;
  const variables = { url };
  const res = await fetch(config.AdminApi, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const jsonRes = await res.json();
  if (jsonRes.errors != null || jsonRes.data == null) {
    throw new Error(
      `Failed to retrieve data from prospect-api for url ${url}.\nErrors: ${JSON.stringify(
        jsonRes.errors
      )}`
    );
  }
  return jsonRes.data.getUrlMetadata as ProspectInfo;
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
      const corpusInput = await hydrateCorpusInput(message);
      // Wait a sec... don't barrage the api. We're just backfilling here.
      await sleep(1000);
      // TODO
      // Here's where you'd call the import mutation instead
      console.log(corpusInput);
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
