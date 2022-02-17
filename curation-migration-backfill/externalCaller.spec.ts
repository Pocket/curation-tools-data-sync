import {
  addLiveCurtedItemsToCorpusApi,
  CreateApprovedCuratedCorpusItemInput,
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
      imageUrl: `https://article.images.consumerreports.org/prod/content/dam/CRO%20Images%202018/Health/August/CR-Health-Inlinehero-are-potatoes-good-for-you-0818.jpg`,
      //todo: this is not a s3 url but https://
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
});
