import fetch from 'node-fetch';
import { Blob } from 'buffer';
import config from './config';
import {
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  HttpLink,
} from '@apollo/client/core';
import { gql } from '@apollo/client/core';
import { createUploadLink } from 'apollo-upload-client';
const https = require('https');
const fs = require('fs');

export type CreateApprovedCuratedCorpusItemInput = {
  prospectId?: string;
  url: string;
  title: string;
  excerpt: string;
  status: string;
  language: string;
  publisher: string;
  imageUrl: string; //todo: this is not a s3 url but https://
  topic: string;
  isCollection: boolean;
  isTimeSensitive: boolean;
  isSyndicated: boolean;
  scheduledDate: string;
  scheduledSurfaceGuid: string;
};

/* wrapper function to call curatedCorpusApi to schedule an item */
export async function addLiveCurtedItemsToCorpusApi(
  input: CreateApprovedCuratedCorpusItemInput
) {
  if (input.imageUrl == null) {
    throw new Error('image url cannot be null as of now');
    //todo: validate this case with backend products
  }

  const image = await fetchFileFromUrl(input.imageUrl);

  if (!image) {
    throw new Error('Failed to download image from source for saving to s3');
  }

  // let downloaded = await downloadFile(input.imageUrl, '/tmp/file');
  // const data = fs.readFileSync('/tmp/file', 'utf8');
  // //let file = new File([image], 'filename.zip', { type: 'application/zip' });
  let s3Url = await generateS3Url('');

  input.imageUrl = s3Url;
  return sendApprovedItemMutation(input);
}

function getClient(): ApolloClient<NormalizedCacheObject> {
  const cache = new InMemoryCache();

  const client = new ApolloClient({
    // Provide required constructor fields
    cache: cache,
    link: createUploadLink({ uri: config.AdminApi, fetch }),
    headers: {
      authorization:
        'Bearer eyJraWQiOiJremU0TTBDaVhvRE83UWtwaWcxb0gwRjZPSW56Wmc2dWdrMFB5b2pPbHpjPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiUUtxcng4R3V3UWdmNDlMdWVpSUFpUSIsInN1YiI6ImRkMjkzZTNlLTQ4ZjgtNGNjNi05YWQ3LTA5OTM1MmY3YzA4YSIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV8xYWxLbHM0cXdfQXV0aDAiXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xXzFhbEtsczRxdyIsImNvZ25pdG86dXNlcm5hbWUiOiJBdXRoMF9hZHxNb3ppbGxhLUxEQVB8c2tpcnNoIiwiZ2l2ZW5fbmFtZSI6IlNyaSIsIm5vbmNlIjoiZWFqdS12d…iOjE2NDUxMjY0NzEsImlhdCI6MTY0NTEyMjg3MSwiZmFtaWx5X25hbWUiOiJLaXJzaCIsImp0aSI6ImY1MTk1YTE1LWI0YTEtNDYwNy1iODFhLWY1YTJhM2Y0NmU4YiIsImVtYWlsIjoic2tpcnNoQG1vemlsbGEuY29tIn0.H_utkOUHI2zHum_gIr2Uc19pqAJ0CkOIX6qXcnny6oukFF6WdYgYLIuFvGZXR8ai3q5iXguiO3jl8JilRDzQqZhVdHpWZjajaazFwPGuPJWh_EiivwcTs_0mhbvCqK5aAW4xeB-bNxUSfXyC_nDRnnOWqz4YW2bET89tBTc8EGJgsbVprgGYRxUddmMIS8mAIG_rfKD67jS71A6BQr7OQeOtxlw9uSCg1LagHq-mNV16rAfUFwBp15p_pPkKMRhZ31xShvXi5FA2LO-jpEZFNX8P_I_UtaewzIJcJXVUL5XSDyZxq__0WJ_Uug5MPM4O0Cieigd9GB5mEg9BSfs7xw',
    },
    // Provide some optional constructor fields
    name: 'backfill',
    version: '1.0',
    queryDeduplication: false,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });

  return client;
}

// downloads image from source url
const fetchFileFromUrl = async (url: string): Promise<Blob | undefined> => {
  const response = await fetch(url);
  if (response.ok) return response.blob();
};

async function generateS3Url(image: any) {
  // const UPLOAD_APPROVED_ITEM_IMAGE = gql`
  //   mutation uploadApprovedCuratedCorpusItemImage($image: Upload!) {
  //     uploadApprovedCuratedCorpusItemImage(data: $image) {
  //       url
  //     }
  //   }
  // `;
  //
  // const variables = {
  //   image: image,
  // };
  //
  // try {
  //   let response = await getClient().mutate({
  //     mutation: UPLOAD_APPROVED_ITEM_IMAGE,
  //     variables: variables,
  //   });
  //   return response;
  // } catch (error) {
  //   console.log(error);
  // }

  return 'https://s3.amazonaws.com/pocket-curatedcorpusapi-dev-images/748ab279-91dd-42be-b72f-95f2ab278c61.jpeg';
}

async function sendApprovedItemMutation(
  item: CreateApprovedCuratedCorpusItemInput
) {
  const createApprovedCuratedCorpusItem = `
    mutation createApprovedCuratedCorpusItem(
      $item: CreateApprovedCuratedCorpusItemInput!
    ) {
      createApprovedCuratedCorpusItem(data: $item) {
        url
        title
      }
    }
  `;

  let variables = {
    item: item,
  };

  return sendGraphQLRequest(createApprovedCuratedCorpusItem, variables);
}

async function sendGraphQLRequest(query: string, variables: any) {
  let serverUrl = config.AdminApi;
  let t = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization:
        'Bearer eyJraWQiOiJremU0TTBDaVhvRE83UWtwaWcxb0gwRjZPSW56Wmc2dWdrMFB5b2pPbHpjPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoia1F5akpRUW0wWGk0TUM3azdUOFVOdyIsInN1YiI6ImRkMjkzZTNlLTQ4ZjgtNGNjNi05YWQ3LTA5OTM1MmY3YzA4YSIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV8xYWxLbHM0cXdfQXV0aDAiXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xXzFhbEtsczRxdyIsImNvZ25pdG86dXNlcm5hbWUiOiJBdXRoMF9hZHxNb3ppbGxhLUxEQVB8c2tpcnNoIiwiZ2l2ZW5fbmFtZSI6IlNyaSIsIm5vbmNlIjoiVHdKczZja29XV0ktcS16blVDVFNDZWRLYW9UeHFtX0tBQW1hRWNrS0MxWjMxZ3FCOFRnZU9NSFBwZkQzZ3FuREs0OTdiRWVucFlXbEk4eXRycjhqT3R3MTJxN0dvRDF3NXFkWTZ1NzNVYWxaYUJQNnkxeElCdVRkTHUyWFNZVjJIVzlQY0h3SHNScHhtM0VDY000OVdTQTVDSU0xVWxDbTF2UHhFZjQ4S2k0IiwiY3VzdG9tOmdyb3VwcyI6IltcImV2ZXJ5b25lXCIsXCJJbnRyYW5ldFdpa2lcIixcIlN0YXRzRGFzaGJvYXJkXCIsXCJhbGxfbGRhcF91c2Vyc1wiLFwiZWdlbmNpYV9jYVwiLFwiZWdlbmNpYV91c1wiLFwib2ZmaWNlX3JlbW90ZVwiLFwicGhvbmVib29rX2FjY2Vzc1wiLFwicG9ja2V0X3ZwblwiLFwidGVhbV9tb2NvXCIsXCJ0ZWFtX21vY29fYmVuZWZpdGVkXCIsXCJ0ZWFtX3BvY2tldFwiLFwidnBuX2NvcnBcIixcInZwbl9kZWZhdWx0XCIsXCJtb3ppbGxpYW5zb3JnX2ppcmFfY2xvdWRfYWNjZXNzXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9iYWNrZW5kXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9kYXRhYW5hbHl0aWNzXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9mZWF0dXJlZmxhZ3NcIixcIm1vemlsbGlhbnNvcmdfcG9ja2V0X3JlYWRvbmx5XCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9zY2hlZHVsZWRfc3VyZmFjZV9jdXJhdG9yX2Z1bGxcIl0iLCJwaWN0dXJlIjoiaHR0cHM6XC9cL3MuZ3JhdmF0YXIuY29tXC9hdmF0YXJcL2YwMDI0NTEzMjU0MDExYWU0NTUwNzU0NzVhMmFlZTc5P3M9NDgwJnI9cGcmZD1odHRwcyUzQSUyRiUyRmNkbi5hdXRoMC5jb20lMkZhdmF0YXJzJTJGc2sucG5nIiwib3JpZ2luX2p0aSI6Ijk0YjQxOGJhLTI4ZjMtNGU5MC04YzFjLWVmZmI3YjM3Y2ZjYiIsImF1ZCI6IjZxdDk0czlkNjUxazI0bXZ1bDlxMmxicmN2IiwiaWRlbnRpdGllcyI6W3sidXNlcklkIjoiYWR8TW96aWxsYS1MREFQfHNraXJzaCIsInByb3ZpZGVyTmFtZSI6IkF1dGgwIiwicHJvdmlkZXJUeXBlIjoiT0lEQyIsImlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUiLCJkYXRlQ3JlYXRlZCI6IjE2MzQwNzYzNjU3OTEifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNjQ1MTI3Mzg2LCJuYW1lIjoiU3JpIEtpcnNoIiwibmlja25hbWUiOiJTcmkgS2lyc2giLCJleHAiOjE2NDUxMzA5ODYsImlhdCI6MTY0NTEyNzM4NiwiZmFtaWx5X25hbWUiOiJLaXJzaCIsImp0aSI6ImExMThhNWJjLWM3ZDItNGIzMC1hM2MzLTc0YjEyNDE1MzU5MCIsImVtYWlsIjoic2tpcnNoQG1vemlsbGEuY29tIn0.NXlDrVEF0BqYZcudvHQMCS2T3Q-QjClSlMzPajcAuX7ayFxkmh4gCQLFUoAB6z-_-ffM3-g8xkrQRznd1RdA8ffk6SVgiWYgHno4hKwEzYAN1Gh1WETvNW9fnvzEwPd4ZMdMh7D8I-XZWzr10II71UQTl-ANu41GogqY9H9IV-td_wBQINsM9LQJxphcS0DLIgACTYPftbvNMjk_er94cPg-FPKwObal2dATZkqZpYcP9TYkza2y_si2rlqb13xOjziB7SpuKa9rvuEAE2WB9Upi67GXrJyoBnCTPR_vXPq6787JL2nIlwyqN33exoPfKZ3AERDVm1PEng8BfOA5XQ',
    },
    body: JSON.stringify({ query: query, variables }),
  }).then((response) => response.json());
  return t;
}

/**
 *
 * @param url - the url where we have our file
 * @param fileFullPath - the full file path where we want to store our image
 * @return {Promise<>}
 */
const downloadFile = async (url, fileFullPath) => {
  console.info('downloading file from url: ' + url);
  return new Promise((resolve, reject) => {
    https
      .get(url, (resp) => {
        // chunk received from the server
        resp.on('data', (chunk) => {
          fs.appendFileSync(fileFullPath, chunk);
        });

        // last chunk received, we are done
        resp.on('end', () => {
          resolve('File downloaded and stored at: ' + fileFullPath);
        });
      })
      .on('error', (err) => {
        reject(new Error(err.message));
      });
  });
};
