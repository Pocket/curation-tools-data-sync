import sinon from 'sinon';
import { Knex } from 'knex';
import { DataService, queries } from './dataService';

describe('fetchTopDomain', () => {
  const sandbox = sinon.createSandbox();
  const conn = {} as Knex;
  const dbService = new DataService(conn);
  const domainStub = sandbox
    .stub(queries, 'topDomainByDomainId')
    .resolves(1234);
  const slugStub = sandbox.stub(queries, 'topDomainBySlug').resolves(5678);
  afterEach(() => sandbox.resetHistory());
  afterAll(() => sandbox.restore());

  it('fetches by slug if is a syndicated article', async () => {
    const conn = {} as Knex;
    const res = await dbService.fetchTopDomain(
      'https://getpocket.com/explore/item/are-birds-actually-real',
      '111'
    );
    sandbox.assert.calledOnceWithExactly(
      slugStub,
      conn,
      'are-birds-actually-real'
    );
    expect(res).toEqual(5678);
  });
  it('fetches by domainId if is not a syndicated article', async () => {
    const conn = {} as Knex;
    const res = await dbService.fetchTopDomain(
      'https://conspiracies.com/are-birds-actually-real',
      '111'
    );
    sandbox.assert.calledOnceWithExactly(domainStub, conn, '111');
    expect(res).toEqual(1234);
  });
});