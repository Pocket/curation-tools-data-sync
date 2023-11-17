import fetch from 'node-fetch';

import config from '../config';
import { ApprovedItemAuthorsInfo } from '../types';

/**
 * Retrieve authors metadata from prospect-api request
 * @param url the URL key for retrieving metadata from prospect-api
 * @returns Promise<ApprovedItemAuthorsInfo> a CSV string of authors
 */
export async function fetchProspectData(
  url: string,
): Promise<ApprovedItemAuthorsInfo> {
  const query = `
  query getUrlMetadata($url: String!) {
    getUrlMetadata(url: $url) {
      authors
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
        jsonRes.errors,
      )}`,
    );
  }

  return jsonRes.data.getUrlMetadata as ApprovedItemAuthorsInfo;
}
