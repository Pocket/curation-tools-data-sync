import { handlerFn } from './';
import * as SecretManager from './secretManager';
import * as Jwt from './jwt';
import sinon from 'sinon';
import nock from 'nock';
import config from './config';
import { SQSEvent } from 'aws-lambda';
import * as ProspectApi from './externalCaller/prospectApiCaller';

describe('curation migration', () => {
  const record = {
    externalId: '123',
    url: 'https://www.test.com/test-story',
    title: 'Equine dentist wins lottery',
    publisher: 'The Snort & Tail',
  };

  beforeEach(() => {
    // mock the secrets manager call
    sinon
      .stub(SecretManager, 'getCurationToolsDataSyncPrivateKey')
      .resolves('test-secret');

    // mock the generate jwt function
    sinon.stub(Jwt, 'generateJwt').returns('test-jwt');
  });

  afterEach(() => {
    sinon.restore();
    jest.clearAllMocks();
  });

  describe('lambda handler', () => {
    it('returns batch item failure if prospect-api has error, with partial success', async () => {
      nock(config.AdminApi)
        .post('/') //prospect-api call for first event
        .reply(200, {
          data: {
            getUrlMetadata: {
              authors: 'Jane Doe,John Doe',
            },
          },
        })
        .post('/') //curated-corpus-api call for first event
        .reply(200, {
          data: {
            updateApprovedCorpusItemAuthors: {
              authors: [
                { name: 'Jane Doe', sortOrder: 1 },
                { name: 'John Doe', sortOrder: 2 },
              ],
            },
          },
        })
        .post('/') // failed prospect-api call for second event
        .reply(200, { errors: [{ message: 'server bork' }] });
      const fakeEvent = {
        Records: [
          { messageId: '1', body: JSON.stringify(record) },
          { messageId: '2', body: JSON.stringify(record) },
        ],
      } as unknown as SQSEvent;

      const actual = await handlerFn(fakeEvent);

      expect(actual).toEqual({ batchItemFailures: [{ itemIdentifier: '2' }] });
    });

    it('returns batch item failure if prospect-api returns null data', async () => {
      nock(config.AdminApi).post('/').reply(200, { data: null });
      const fakeEvent = {
        Records: [{ messageId: '1', body: JSON.stringify(record) }],
      } as unknown as SQSEvent;
      const actual = await handlerFn(fakeEvent);
      expect(actual).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
    });

    it('returns no batch item failures if curated-corpus-api request is successful', async () => {
      //when both prospectApi and curatedCorpusApi calls return success,
      // no batch item should fail
      sinon.stub(ProspectApi, 'fetchProspectData').returns(
        Promise.resolve({
          authors: 'Jack London,Mark Twain',
        })
      );

      //nock the curatedCorpusApi call
      nock(config.AdminApi)
        .post('/') //curated-corpus-api call for first event
        .reply(200, {
          data: {
            updateApprovedCorpusItemAuthors: {
              authors: [
                { name: 'Jack London', sortOrder: 1 },
                { name: 'Mark Twain', sortOrder: 2 },
              ],
            },
          },
        })
        .post('/') //curated-corpus-api call for first event
        .reply(200, {
          data: {
            updateApprovedCorpusItemAuthors: {
              authors: [
                { name: 'Another Author', sortOrder: 1 },
                { name: 'More Authors Here', sortOrder: 2 },
              ],
            },
          },
        });

      // create two fake sqs events
      const fakeEvent = {
        Records: [
          { messageId: '1', body: JSON.stringify(record) },
          { messageId: '2', body: JSON.stringify(record) },
        ],
      } as unknown as SQSEvent;

      // call our lambda handler function
      const actual = await handlerFn(fakeEvent);

      // we should get no failed items
      expect(actual).toEqual({
        batchItemFailures: [],
      });
    });

    it('returns batch item failure if curated-corpus-api request throws an error', async () => {
      // mock the first request to prospect-api to be successful
      // the second request (post) is made to curated-corpus-api, let's fail that one with a graphql error

      //for the first batch item
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              authors: 'Jane Doe,John Doe',
            },
          },
        })
        .post('/')
        .reply(200, {
          errors: [{ message: 'test-graphql-error' }],
        });

      //for the second batch item
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              authors: 'Jane Doe,John Doe',
            },
          },
        })
        .post('/')
        .reply(200, {
          errors: [{ message: 'test-graphql-error' }],
        });

      // create two fake sqs events
      const fakeEvent = {
        Records: [
          { messageId: '1', body: JSON.stringify(record) },
          { messageId: '2', body: JSON.stringify(record) },
        ],
      } as unknown as SQSEvent;

      // call our lambda handler function
      const actual = await handlerFn(fakeEvent);

      // we should get two failed items
      expect(actual).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }, { itemIdentifier: '2' }],
      });
    });
  });
});
