import {
  addLiveCurtedItemsToCorpusApi,
  CreateApprovedCuratedCorpusItemInput,
  getS3UrlFromImageUrl,
} from './externalCaller';

describe('curatedCorpusApi mutations test', () => {
  beforeAll(async () => {
    await jest.setTimeout(60000);
  });

  it('should save a scheduled Item', async () => {
    const testData: CreateApprovedCuratedCorpusItemInput = {
      url: 'https://www.consumerreports.org/healthy-eating/are-potatoes-good-for-you/',
      title: 'Are potatoes good for you',
      excerpt: 'some test excerpt',
      status: 'CORPUS', //todo: check what should be the default for this
      language: `en`,
      publisher: `the guardian`,
      imageUrl:
        'https://s3.amazonaws.com/pocket-curatedcorpusapi-dev-images/748ab279-91dd-42be-b72f-95f2ab278c61.jpeg',
      //todo: this is not a s3 url but https://
      //we need the uploadMutation working
      topic: `FOOD`,
      isCollection: false,
      isTimeSensitive: false,
      isSyndicated: false,
      scheduledDate: `2022-02-16`,
      scheduledSurfaceGuid: `NEW_TAB_EN_US`,
      //todo: we don't have option to add createdAt, updatedAt, createdBy, updatedBy
    };

    const response = await addLiveCurtedItemsToCorpusApi(testData);
    console.log(response);
  });

  it('should be able to derive a s3 url from http url', async () => {
    const testData = {
      url: 'https://www.consumerreports.org/healthy-eating/are-potatoes-good-for-you/',
      //todo: we don't have option to add createdAt, updatedAt, createdBy, updatedBy
    };

    const response = await getS3UrlFromImageUrl(testData.url);
    console.log(response);
  });
});
