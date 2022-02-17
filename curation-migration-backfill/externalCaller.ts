import fetch from 'node-fetch';
import { Blob } from 'buffer';
import config from './config';
//import { gql } from '@apollo/client/core';
//import { createUploadLink } from 'apollo-upload-client';
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

/***
 * wrapper function to convert
 *  imageurl -> s3Url
 *  calls ApprovedItemMutation
 * @param input
 */
export async function addLiveCurtedItemsToCorpusApi(
  input: CreateApprovedCuratedCorpusItemInput
) {
  if (input.imageUrl == null) {
    throw new Error('image url cannot be null as of now');
    //todo: validate this case with backend products
  }

  //uncomment this after fixing image upload
  //let s3Url = getS3UrlFromImageUrl(input.imageUrl);
  //input.imageUrl = s3Url;

  return sendApprovedItemMutation(input);
}

/***
 * function to convert image url to imageBlob and calls the
 * uploadImage mutation
 * @param input
 */
export async function getS3UrlFromImageUrl(imageUrl: string) {
  const image = await fetchFileFromUrl(imageUrl);

  if (!image) {
    throw new Error('Failed to download image from source for saving to s3');
  }

  let s3Url = await generateS3Url(image);

  return s3Url;
}

/***
 * downloads from the source
 * @param url
 */
const fetchFileFromUrl = async (url: string): Promise<Blob | undefined> => {
  const response = await fetch(url);
  if (response.ok) return response.blob();
};

/***
 * function to call uploadApprovedCuratedCorpusItemImage mutation
 * @param image
 */
async function generateS3Url(image: any) {
  const UPLOAD_APPROVED_ITEM_IMAGE = `
    mutation uploadApprovedCuratedCorpusItemImage($image: Upload!) {
      uploadApprovedCuratedCorpusItemImage(data: $image) {
        url
      }
    }
  `;

  const variables = {
    image: image,
  };

  // try {
  //   let response = await getClient().mutate({
  //     mutation: UPLOAD_APPROVED_ITEM_IMAGE,
  //     variables: variables,
  //   });
  //   return response;
  // } catch (error) {
  //   console.log(error);
  // }
}

/***
 * function to call createApprovedCuratedCorpusItem mutation
 * @param item
 */
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

/***
 * constructs a GRAPHQL request for given query and variables
 * Note: need to add updated token
 * @param query
 * @param variables
 */
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
// const downloadFile = async (url, fileFullPath) => {
//   console.info('downloading file from url: ' + url);
//   return new Promise((resolve, reject) => {
//     https
//       .get(url, (resp) => {
//         // chunk received from the server
//         resp.on('data', (chunk) => {
//           fs.appendFileSync(fileFullPath, chunk);
//         });
//
//         // last chunk received, we are done
//         resp.on('end', () => {
//           resolve('File downloaded and stored at: ' + fileFullPath);
//         });
//       })
//       .on('error', (err) => {
//         reject(new Error(err.message));
//       });
//   });
// };

// /***
//  * generates apollo client
//  */
// function getClient(): ApolloClient<NormalizedCacheObject> {
//   const cache = new InMemoryCache();
//   const client = new ApolloClient({
//     // Provide required constructor fields
//     cache: cache,
//     //link: createUploadLink({ uri: config.AdminApi, fetch }),
//     headers: {
//       authorization:
//         'Bearer eyJraWQiOiJremU0TTBDaVhvRE83UWtwaWcxb0gwRjZPSW56Wmc2dWdrMFB5b2pPbHpjPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoia0FsUnpWVGpSX2VBRElKb3FtSXU5ZyIsInN1YiI6ImRkMjkzZTNlLTQ4ZjgtNGNjNi05YWQ3LTA5OTM1MmY3YzA4YSIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV8xYWxLbHM0cXdfQXV0aDAiXSwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xXzFhbEtsczRxdyIsImNvZ25pdG86dXNlcm5hbWUiOiJBdXRoMF9hZHxNb3ppbGxhLUxEQVB8c2tpcnNoIiwiZ2l2ZW5fbmFtZSI6IlNyaSIsIm5vbmNlIjoiUzlRTjNoUFJaWFdDR1Y3dHhsaTh5c2gxa3lXZ3Nlb05YVlZEZDRhVG1jYzN5aUJjSUtxZEhPUGNHWmxKaDBXdWJwSWdCeWFTR3BfUDZuSE5fdFhRcEZnNmhkb1hudW1MQy02b25PakpINzVDdDJLR0ZDX1VIX00tM1oyekt6T05KQjJqVnB2VHhHdWF2WnBuQUQ3UFpNdTNxNjB0QTFFYUZyQkpIejJybTd3IiwiY3VzdG9tOmdyb3VwcyI6IltcImV2ZXJ5b25lXCIsXCJJbnRyYW5ldFdpa2lcIixcIlN0YXRzRGFzaGJvYXJkXCIsXCJhbGxfbGRhcF91c2Vyc1wiLFwiZWdlbmNpYV9jYVwiLFwiZWdlbmNpYV91c1wiLFwib2ZmaWNlX3JlbW90ZVwiLFwicGhvbmVib29rX2FjY2Vzc1wiLFwicG9ja2V0X3ZwblwiLFwidGVhbV9tb2NvXCIsXCJ0ZWFtX21vY29fYmVuZWZpdGVkXCIsXCJ0ZWFtX3BvY2tldFwiLFwidnBuX2NvcnBcIixcInZwbl9kZWZhdWx0XCIsXCJtb3ppbGxpYW5zb3JnX2ppcmFfY2xvdWRfYWNjZXNzXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9iYWNrZW5kXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9kYXRhYW5hbHl0aWNzXCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9mZWF0dXJlZmxhZ3NcIixcIm1vemlsbGlhbnNvcmdfcG9ja2V0X3JlYWRvbmx5XCIsXCJtb3ppbGxpYW5zb3JnX3BvY2tldF9zY2hlZHVsZWRfc3VyZmFjZV9jdXJhdG9yX2Z1bGxcIl0iLCJwaWN0dXJlIjoiaHR0cHM6XC9cL3MuZ3JhdmF0YXIuY29tXC9hdmF0YXJcL2YwMDI0NTEzMjU0MDExYWU0NTUwNzU0NzVhMmFlZTc5P3M9NDgwJnI9cGcmZD1odHRwcyUzQSUyRiUyRmNkbi5hdXRoMC5jb20lMkZhdmF0YXJzJTJGc2sucG5nIiwib3JpZ2luX2p0aSI6ImQ1ZWRmZDA4LTJlZDUtNDdiOS05OTQxLTg5OTY4N2E5NDNmMSIsImF1ZCI6IjZxdDk0czlkNjUxazI0bXZ1bDlxMmxicmN2IiwiaWRlbnRpdGllcyI6W3sidXNlcklkIjoiYWR8TW96aWxsYS1MREFQfHNraXJzaCIsInByb3ZpZGVyTmFtZSI6IkF1dGgwIiwicHJvdmlkZXJUeXBlIjoiT0lEQyIsImlzc3VlciI6bnVsbCwicHJpbWFyeSI6InRydWUiLCJkYXRlQ3JlYXRlZCI6IjE2MzQwNzYzNjU3OTEifV0sInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNjQ1MTMzNjc5LCJuYW1lIjoiU3JpIEtpcnNoIiwibmlja25hbWUiOiJTcmkgS2lyc2giLCJleHAiOjE2NDUxMzcyNzksImlhdCI6MTY0NTEzMzY3OSwiZmFtaWx5X25hbWUiOiJLaXJzaCIsImp0aSI6ImU1YmIxOWMyLTFlNTctNDVmNC04N2JhLTA4Yjg4MTljN2Q0YSIsImVtYWlsIjoic2tpcnNoQG1vemlsbGEuY29tIn0.Xji7vbK3HdpAHG_MA8nJhZ2out4E8ILhdAtuBMlxg0aWpB6tjQvzCQaJ5Sa5hsxT8fJh3-FDuf-rmrwo2zj1YZjr_TCzI5jizkREb-Edc11kVroFelVuZV_vJL1S155y4rUuUiSnSuHmeC80ZLExymNieTNRf3-5otYwTXaypoQ3uKIPDYvWHzBvg86a068ItMtjZnt_SLCe2Zc7__EzZkAU6xGGhGTFqwI3qTUY14JgiruKMPrEC7Znn2flJbEJT1Wyc7Qw5-2lXMIQh8t5rgYYRHiO0x7kHlBPbKYbWiQJ1svj-6q99JXGh11gURJTxPmYEdrbdeJjD8XoxPeznQ',
//     },
//     // Provide some optional constructor fields
//     name: 'backfill',
//     version: '1.0',
//     queryDeduplication: false,
//     defaultOptions: {
//       watchQuery: {
//         fetchPolicy: 'cache-and-network',
//       },
//     },
//   });
//
//   return client;
// }
