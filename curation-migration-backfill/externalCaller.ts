import fetch from 'node-fetch';
import { Blob } from 'buffer';
import config from './config';

export type ApprovedItemInput = {
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
export async function addLiveCurtedItemsToCorpusApi(input: ApprovedItemInput) {
  if (input.imageUrl == null) {
    throw new Error('image url cannot be null as of now');
    //todo: validate this case with backend products
  }

  const image = await fetchFileFromUrl(input.imageUrl);

  if (!image) {
    throw new Error('Failed to download image from source for saving to s3');
  }

  let s3Url = await generateS3Url(image);
  return s3Url;
}

async function generateS3Url(image: Blob) {
  const uploadApprovedCuratedCorpusItemImage = `
  mutation uploadApprovedCuratedCorpusItemImage($image: Upload!) {
    uploadApprovedCuratedCorpusItemImage(image: $image) {
      url
    }
  }`;
  const variables = {
    image: image,
  };
  let response = await sendGraphQLRequest(
    uploadApprovedCuratedCorpusItemImage,
    variables
  );
  return response;
}

function sendApprovedItemMutation() {
  const createApprovedCuratedCorpusItem = `
  mutation createApprovedCuratedCorpusItem($id: ID!) {
    createApprovedCuratedCorpusItem(id: $id)
  }`;
}

async function sendGraphQLRequest(query: string, variables: any) {
  let serverUrl = config.AdminApi;
  let t = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query, variables }),
  }).then((response) => response.json());
  return t;
}

// downloads image from source url
const fetchFileFromUrl = async (url: string): Promise<Blob | undefined> => {
  const response = await fetch(url);
  if (response.ok) return response.blob();
};
