import { CorpusInput } from '../types';
import config from '../config';
import fetch from 'node-fetch';

/**
 * Call the importApprovedCuratedCorpusItem mutation
 * @param data input variables for the mutation. Of the type CorpusInput
 * @returns Promise<ImportApprovedCuratedCorpusItemPayload>
 */
export async function importApprovedCuratedCorpusItem(data: CorpusInput) {
  console.log('executing mutation importApprovedCuratedCorpusItem');
  const mutation = `
  mutation importApprovedItem($data: ImportApprovedCuratedCorpusItemInput!) {
    importApprovedCuratedCorpusItem(data: $data) {
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

  const variables = { data };
  const res = await fetch(config.AdminApi, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer bla',
    },
    body: JSON.stringify({ mutation, variables }),
  });

  const jsonRes = await res.json();

  return jsonRes;
}
