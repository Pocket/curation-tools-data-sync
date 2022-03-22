import { handlerFn } from './';
import * as SecretManager from './secretManager';
import * as Jwt from './jwt';
import sinon from 'sinon';
import nock from 'nock';
import config from './config';
import { SQSEvent } from 'aws-lambda';

describe('curation migration', () => {
  const record = {
    curated_rec_id: '123',
    time_live: 1647042571,
    time_added: 1647042571,
    time_updated: 1647042572,
    title: 'Equine dentist wins lottery',
    excerpt: `"It's kind of against my job description," said Dr. Orsteeth, "but this is definitely a case where I don't want to look a gift horse in the mouth!"`,
    curator: 'cohara',
    image_src: 'https://some-image.png',
    resolved_id: '123',
    resolved_url: 'https://yougotgums.com',
    lang: 'en',
    topic_name: 'entertainment',
    feed_id: 8,
    slug: 'en-intl',
  };

  beforeAll(() => {
    // mock the secrets manager call
    sinon
      .stub(SecretManager, 'getCurationToolsDataSyncPrivateKey')
      .resolves('test-secret');

    // mock the generate jwt function
    sinon.stub(Jwt, 'generateJwt').returns('test-jwt');
  });

  afterAll(() => {
    sinon.restore();
  });

  describe('lambda handler', () => {
    it('formats record as expected', async () => {
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
            },
          },
        });

      const fakeEvent = {
        Records: [{ body: JSON.stringify(record) }],
      } as unknown as SQSEvent;
      await handlerFn(fakeEvent);
      // TODO: Check the spy of the import mutation to see that it's called
      // with args that match below
      // expect(mutationStub.firstCall.args[0]).toEqual(
      //   {
      //     url: 'https://yougotgums.com',
      //     title: 'Equine dentist wins lottery',
      //     excerpt: `"It's kind of against my job description," said Dr. Orsteeth, "but this is definitely a case where I don't want to look a gift horse in the mouth!"`,
      //     status: 'RECOMMENDATION',
      //     language: 'EN',
      //     publisher: 'Gums Weekly',
      //     imageUrl: 'https://some-image.png',
      //     topic: 'entertainment',
      //     source: 'BACKFILL',
      //     isCollection: false,
      //     isSyndicated: true,
      //     createdAt: 1647042571,
      //     updatedAt: 1647042572,
      //     createdBy: 'ad|Mozilla-LDAP|cohara',
      //     updatedBy: 'ad|Mozilla-LDAP|cohara',
      //     scheduledDate: '2022-03-11',
      //     scheduledSurfaceGuid: 'NEW_TAB_EN_INTL',
      //   },
      // );
    });
    it('returns batch item failure if prospect-api has error, with partial success', async () => {
      nock(config.AdminApi)
        .post('/') //prospect-api call for first event
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
            },
          },
        })
        .post('/') //curated-corpus-api call for first event
        .reply(200, {
          data: {
            importApprovedItem: {
              approvedItem: {},
              scheduledItem: {},
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
    it('returns batch item failure if curator is null', async () => {
      const anotherRecord = { ...record, curator: null };
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
            },
          },
        });
      const fakeEvent = {
        Records: [{ messageId: '1', body: JSON.stringify(anotherRecord) }],
      } as unknown as SQSEvent;
      const actual = await handlerFn(fakeEvent);
      expect(actual).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
    });
    it('returns batch item failure if curator cannot be mapped to sso user', async () => {
      const anotherRecord = { ...record, curator: 'countdracula' };
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
            },
          },
        });
      const fakeEvent = {
        Records: [{ messageId: '1', body: JSON.stringify(anotherRecord) }],
      } as unknown as SQSEvent;
      const actual = await handlerFn(fakeEvent);
      expect(actual).toEqual({ batchItemFailures: [{ itemIdentifier: '1' }] });
    });

    it('returns no batch item failures if curated-corpus-api request is successful', async () => {
      // mock the first request to prospect-api to be successful.
      // the second request (post) is made to curated-corpus-api
      // both requests are times 2 since we are testing for two sqs events
      nock(config.AdminApi)
        .post('/')
        .times(2)
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
            },
          },
        });

      nock(config.AdminApi)
        .post('/')
        .times(2)
        .reply(200, {
          data: {
            importApprovedItem: {
              approvedItem: {},
              scheduledItem: {},
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
      nock(config.AdminApi)
        .post('/')
        .reply(200, {
          data: {
            getUrlMetadata: {
              isSyndicated: true,
              isCollection: false,
              publisher: 'Gums Weekly',
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
