import { getCurator } from './mapCurator';

describe('curator unit test', () => {
  it('returns sso curatorName for old readitla-tmp curator name', () => {
    let expected = 'ad|Mozilla-LDAP|trunge';
    expect(getCurator('tillrunge')).toBe(expected);
  });

  it('returns sso curatorName for old readitla-tmp curator name', () => {
    let expected = 'ad|Mozilla-LDAP|unknown';
    expect(getCurator('non-existent')).toBe(expected);
  });
});
