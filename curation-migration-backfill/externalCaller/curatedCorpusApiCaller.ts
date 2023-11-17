import { CorpusInput } from '../types';
import config from '../config';
import fetch from 'node-fetch';
import { generateJwt } from '../jwt';
import { getCurationToolsDataSyncPrivateKey } from '../secretManager';

/**
 * Call the importApprovedCorpusItem mutation
 * @param data input variables for the mutation. Of the type CorpusInput
 * @returns json response of type ImportApprovedCorpusItemPayload
 */
export async function importApprovedCorpusItem(data: CorpusInput) {
  const mutation = `
  mutation importApprovedItem($data: ImportApprovedCorpusItemInput!) {
    importApprovedCorpusItem(data: $data) {
      approvedItem {
        externalId
      }
      scheduledItem {
        externalId
        scheduledSurfaceGuid
      }
    }
  }
`;

  //admin api requires jwt token to fetch to add a scheduledItem
  const bearerToken = 'Bearer '.concat(
    generateJwt(await getCurationToolsDataSyncPrivateKey()),
  );

  const variables = { data };
  const res = await fetch(config.AdminApi, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: bearerToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  return await res.json();
}
