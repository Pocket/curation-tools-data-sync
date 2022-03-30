import { convertDateToTimestamp, getCuratorNameFromSso } from './eventConsumer';

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
  it('returns curator name from sso string', () => {
    let expected = 1648512000;
    //convertDateToTimestamp epoc timestamp shows 2022-03-29 08:05 pm gmt
    expect(convertDateToTimestamp('2022-03-29')).toEqual(expected);
  });
});
