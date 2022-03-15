import { getCurator } from './mapCurator';

describe('curator unit test', () => {
  it('returns sso curatorName for old readitla-tmp curator name', () => {
    let expected = 'trunge';
    expect(getCurator('tillrunge')).toBe(expected);
  });
});
