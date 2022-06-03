import fetch from 'node-fetch';

import config from '../config';
import { ProspectInfo } from '../types';

/**
 * Retrieve metadata from prospect-api request
 * @param url the URL key for retrieving metadata from prospect-api
 * @returns Promise<ProspectInfo>
 */
export async function fetchProspectData(url: string): Promise<ProspectInfo> {
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
