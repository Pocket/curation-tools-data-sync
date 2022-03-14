import { epochToDateString, handlerFn } from './';
import nock from 'nock';
import config from './config';
import { SQSEvent } from 'aws-lambda';

describe('curation migration', () => {
  const record = {
    curated_rec_id: '123',
    time_live: 1647042571,
    time_added: 1647042571,
    time_updated: 999999999,
    title: 'Equine dentist wins lottery',
    excerpt: `"It's kind of against my job description," said Dr. Orsteeth, "but this is definitely a case where I don't want to look a gift horse in the mouth!"`,
    curator: 'btownie',
    image_src: 'https://some-image.png',
    resolved_id: '123',
    resolved_url: 'https://yougotgums.com',
    lang: 'en',
    topic_name: 'entertainment',
    feed_id: 8,
    slug: 'en-intl',
  };
  describe('epochToDateString', () => {
    it('works for for zero-padded months', async () => {
      const date = 1647042571; // 2022-03-11 23:49:31 UTC
      expect(epochToDateString(date)).toEqual('2022-03-11');
    });
    it('works for two-digit months', async () => {
      const date = 1671032431; // 2022-12-14 15:40:31 UTC
      expect(epochToDateString(date)).toEqual('2022-12-14');
    });
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
      const actual = await handlerFn(fakeEvent);
      expect(actual).toEqual([
        {
          url: 'https://yougotgums.com',
          title: 'Equine dentist wins lottery',
          excerpt: `"It's kind of against my job description," said Dr. Orsteeth, "but this is definitely a case where I don't want to look a gift horse in the mouth!"`,
          status: 'RECOMMENDATION',
          language: 'en',
          publisher: 'Gums Weekly',
          imageUrl: 'https://some-image.png',
          topic: 'entertainment',
          source: 'BACKFILL',
          isCollection: false,
          isSyndicated: true,
          createdAt: 1647042571,
          updatedAt: 1647042571,
          createdBy: 'ad|Mozilla-LDAP|btownie',
          updatedBy: 'ad|Mozilla-LDAP|btownie',
          scheduledDate: '2022-03-11',
          scheduledSurfaceGuid: 'NEW_TAB_EN_INTL',
        },
      ]);
    });
    it('throws an error if prospect-api has error', async () => {
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
        .reply(200, { errors: [{ message: 'server bork' }] });
      const fakeEvent = {
        Records: [
          { body: JSON.stringify(record) },
          { body: JSON.stringify(record) },
        ],
      } as unknown as SQSEvent;
      await expect(() => handlerFn(fakeEvent)).rejects.toThrowError(
        'Failed to retrieve data from prospect-api for url https://yougotgums.com'
      );
    });
    it('throws an error if prospect-api returns null data', async () => {
      nock(config.AdminApi).post('/').reply(200, { data: null });
      const fakeEvent = {
        Records: [{ body: JSON.stringify(record) }],
      } as unknown as SQSEvent;
      await expect(() => handlerFn(fakeEvent)).rejects.toThrowError(
        'Failed to retrieve data from prospect-api for url https://yougotgums.com'
      );
    });
    it('sets curator to "unknown" if null', async () => {
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
        Records: [{ body: JSON.stringify(anotherRecord) }],
      } as unknown as SQSEvent;
      const actual = await handlerFn(fakeEvent);
      expect(actual[0].createdBy).toEqual('unknown');
      expect(actual[0].updatedBy).toEqual('unknown');
    });
  });
});
