import sinon from 'sinon';
import { Knex } from 'knex';
import { DataService } from './dataService';

describe('fetchTopDomain', () => {
  const sandbox = sinon.createSandbox();
  const conn = {} as Knex;
  const dbService = new DataService(conn);
  const domainStub = sandbox
    .stub(dbService, 'topDomainByDomainId')
    .resolves(1234);
  afterEach(() => sandbox.resetHistory());
  afterAll(() => sandbox.restore());

  it('fetches by domainId', async () => {
    const res = await dbService.fetchTopDomain(
      'https://conspiracies.com/are-birds-actually-real',
      '111',
    );
    sandbox.assert.calledOnceWithExactly(domainStub, '111');
    expect(res).toEqual(1234);
  });
});
