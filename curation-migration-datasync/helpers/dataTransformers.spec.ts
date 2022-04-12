import {
  convertDateToTimestamp,
  convertUtcStringToTimestamp,
  getCuratorNameFromSso,
} from './dataTransformers';

describe('data transformer methods', () => {
  describe('sso to curator name test', () => {
    it('returns curator name from sso string', () => {
      expect(getCuratorNameFromSso('ad|Mozilla-LDAP|cohara')).toEqual('cohara');
    });

    it('returns error for invalid sso name', () => {
      expect(() => {
        getCuratorNameFromSso('thawk');
      }).toThrow(
        'unexpected sso format, createdBy are expected to startWith `ad|Mozilla-LDAP|`'
      );
    });
  });

  describe('scheduledDate to timestamp', () => {
    it('returns epoc timestamp for the given date', () => {
      const expected = 1648512000;
      //convertDateToTimestamp epoc timestamp shows 2022-03-29 08:05 pm gmt
      expect(convertDateToTimestamp('2022-03-29')).toEqual(expected);
    });
  });

  describe('utc string to timestamp', () => {
    it('returns epoc timestamp for a utc string', () => {
      const expected = 1649109315;
      const epoc = convertUtcStringToTimestamp('Mon, 04 Apr 2022 21:55:15 GMT');
      expect(epoc).toEqual(expected);
    });
  });
});
