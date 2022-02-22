import {
  addLiveCuratedItemsToCorpusApi,
  CreateApprovedCuratedCorpusItemInput,
} from './externalCaller';
import fetch from 'node-fetch';

const csv = require('csv-parser');
const fs = require('fs');

export type MigrationRow = {
  curated_rec_id: string;
  status: string;
  time_live: string;
  time_added: number;
  time_updated: number;
  prospect_id: string;
  title: string;
  exceprt: string;
  curator: string;
  image_src: string;
  resolved_url: string;
  resolved_id: number;
  lang: string;
  name: string;
  slug: string;
  isSyndicated?: number;
  top_domain_id: string; //todo: change it to no once you can get parser
};
export async function readFile(filename: string): Promise<MigrationRow[]> {
  let rows: MigrationRow[] = [];

  return await new Promise((resolve) =>
    fs
      .createReadStream(filename)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        resolve(rows);
      })
  );
}

export async function convertMigrationToCuratedCorpusData(row: MigrationRow) {
  let parserData = await getParserData(row.resolved_url);
  let createMutationInput: CreateApprovedCuratedCorpusItemInput = {
    //todo: can we do a 1:1 map of prospect_id?
    url: row.resolved_url,
    title: row.title,
    excerpt: parserData.excerpt, //row.exceprt,
    status: `CORPUS`, //todo: check, for now defaulting to corpus
    language: row.lang,
    publisher: parserData.publisher,
    //todo: null values present for this
    imageUrl:
      'https://s3.amazonaws.com/pocket-curatedcorpusapi-dev-images/748ab279-91dd-42be-b72f-95f2ab278c65.jpeg',
    topic: row.name.toUpperCase(), //todo: topic name is null, what to substitute with for null fields ?
    isCollection: false,
    isTimeSensitive: false,
    isSyndicated: row.isSyndicated == 1,
    scheduledDate: convertTimestampToDate(row.time_live),
    scheduledSurfaceGuid: mapNewTabGuid(row.slug),
    //all test data right now has us, but need to write string test conversion fn
    //for old pattern to new_tab_en_us
  };

  const response = await addLiveCuratedItemsToCorpusApi(createMutationInput);
  return response;
}

function convertTimestampToDate(timestamp: string) {
  let t = parseInt(timestamp) * 1000;
  let d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function getParserData(resolvedUrl: string) {
  const response = await fetch(
    `https://text.getpocket.com/v3beta/getItemListApi?url=${encodeURIComponent(
      resolvedUrl
    )}&getItem=1`
  );

  const data: any = await response.json();
  const item = data.item;
  if (!item || (item && !item.item_id) || (item && !item.resolved_id)) {
    throw new Error(`Unable to parse and generate item for ${resolvedUrl}`);
  }

  return {
    itemId: item.item_id,
    resolvedId: item.resolved_id,
    title: item.title ?? '',
    excerpt: item.excerpt ?? '',
    publisher: item.domain_metadata.name ?? '',
  };
}

function mapNewTabGuid(newTabGuid: string) {
  const mapping = {
    'global-en-US': 'NEW_TAB_EN_US',
    'global-en-UK': 'NEW_TAB_EN_UK',
  };

  return mapping[newTabGuid];
}
