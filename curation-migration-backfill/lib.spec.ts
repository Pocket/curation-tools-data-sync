import { BackfillMessage, CorpusInput, ProspectInfo } from './types';
import {
  curatorToSsoUser,
  epochToDateString,
  hydrateCorpusInput,
  languageExtractor,
} from './lib';

describe('lib', () => {
  describe('curatorToSsoUser', () => {
    it('should map a curator to an SSO user', () => {
      expect(curatorToSsoUser('cohara')).toEqual('ad|Mozilla-LDAP|cohara');
    });

    it('should throw an error the curator is unable to be mapped', () => {
      expect(() => {
        curatorToSsoUser('thawk');
      }).toThrow(`curator value 'thawk' has no valid mapping to SSO User`);
    });

    it('should throw an error if a null curator is passed', () => {
      expect(() => {
        curatorToSsoUser(null);
      }).toThrow(`curator value 'null' has no valid mapping to SSO User`);
    });
  });

  describe('languageExtractor', () => {
    it('should return the language in uppercase if provided', () => {
      expect(languageExtractor('en', 'NEW_TAB_EN_US')).toEqual('EN');
      expect(languageExtractor('fr', 'NEW_TAB_EN_GB')).toEqual('FR');
    });

    it(`should return 'EN' if null language provided and surface GUID doesn't contain 'de'`, () => {
      expect(languageExtractor(null, 'NEW_TAB_EN_US')).toEqual('EN');
    });

    it(`should return 'EN' if empty string language provided and surface GUID doesn't contain 'de'`, () => {
      expect(languageExtractor('', 'NEW_TAB_EN_INTL')).toEqual('EN');
    });

    it(`should return 'DE' if no language provided and surface GUID contains 'de'`, () => {
      expect(languageExtractor(null, 'NEW_TAB_DE_DE')).toEqual('DE');
    });
  });

  describe('epochToDateString: should convert to YYYY-MM-DD UTC', () => {
    it('works for for zero-padded months', () => {
      const date = 1647042571; // 2022-03-11 23:49:31 UTC
      expect(epochToDateString(date)).toEqual('2022-03-11');
    });
    it('works for two-digit months', () => {
      const date = 1671032431; // 2022-12-14 15:40:31 UTC
      expect(epochToDateString(date)).toEqual('2022-12-14');
    });
    it('works for zero-padded days', () => {
      const date = 1646162014; // 2022-03-01 11:13:34 UTC
      expect(epochToDateString(date)).toEqual('2022-03-01');
    });
    it('works for two-digit days', () => {
      const date = 1671032431; // 2022-12-14 15:40:31 UTC
      expect(epochToDateString(date)).toEqual('2022-12-14');
    });
    it('works for two-digit months', async () => {
      const date = 1646254612; // Thu, 02 Mar 2022 20:56:52 GMT
      expect(epochToDateString(date)).toEqual('2022-03-02');
    });
  });

  describe('hydrateCorpusInput', () => {
    const message: BackfillMessage = {
      curated_rec_id: '123',
      time_live: 1647553314,
      time_added: 1647553314,
      time_updated: 1647553314,
      title: 'i am an article',
      excerpt: 'excerpt',
      curator: 'cohara',
      image_src: 'https://via.placeholder.com/150',
      resolved_id: 1,
      resolved_url: 'https://getpocket.com',
      lang: 'en',
      topic_name: 'Technology', //use values from TopicMapper.
      feed_id: 1,
      slug: 'get-pocket',
    };

    const prospectInfo: ProspectInfo = {
      isCollection: false,
      isSyndicated: false,
      publisher: 'pocket',
    };

    it('should hydrate', () => {
      const expected: CorpusInput = {
        url: 'https://getpocket.com',
        title: 'i am an article',
        excerpt: 'excerpt',
        status: 'RECOMMENDATION',
        language: 'EN',
        imageUrl: 'https://via.placeholder.com/150',
        topic: 'TECHNOLOGY',
        source: 'BACKFILL',
        createdAt: 1647553314,
        updatedAt: 1647553314,
        createdBy: 'ad|Mozilla-LDAP|cohara',
        updatedBy: 'ad|Mozilla-LDAP|cohara',
        scheduledDate: epochToDateString(1647553314),
        scheduledSurfaceGuid: 'NEW_TAB_EN_US',
        isCollection: false,
        isSyndicated: false,
        publisher: 'pocket',
      };

      const result = hydrateCorpusInput(message, prospectInfo);

      expect(result).toEqual(expected);
    });
  });
});
