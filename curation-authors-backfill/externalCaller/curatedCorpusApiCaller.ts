import { ApprovedItemAuthorsInput } from '../types';
import config from '../config';
import fetch from 'node-fetch';
import { generateJwt } from '../jwt';
import { getCurationToolsDataSyncPrivateKey } from '../secretManager';

/**
 * Call the updateApprovedCorpusItemAuthors mutation
 * @param data input variables for the mutation. Of the type ApprovedItemAuthorsInput
 * @returns TODO: what return do we need here? technically i think nothing, but maybe we return the fields requested below for logging/verification?
 */
export async function updateApprovedCorpusItemAuthors(
  data: ApprovedItemAuthorsInput,
) {
  const mutation = `
  mutation updateApprovedCorpusItemAuthors($data: UpdateApprovedCorpusItemAuthorsInput!) {
    updateApprovedCorpusItemAuthors(data: $data) {
      externalId
      url
      title
      authors {
        name
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
