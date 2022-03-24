import sinon from 'sinon';
import { queries } from './dbClient';
import { Knex } from 'knex';
import { fetchTopDomain } from './dataservice';
import * as parser from './parser';

describe('fetchTopDomain', () => {
  const sandbox = sinon.createSandbox();
  const domainStub = sandbox
    .stub(queries, 'topDomainByDomainId')
    .resolves(1234);
  const slugStub = sandbox.stub(queries, 'topDomainBySlug').resolves(5678);
  const parserStub = sandbox
    .stub(parser, 'getParserMetadata')
    .resolves({ domainId: '999', resolvedId: '111' });
  afterEach(() => sandbox.resetHistory());
  afterAll(() => sandbox.restore());

  it('fetches by slug if is a syndicated article', async () => {
    const conn = {} as Knex;
    const res = await fetchTopDomain(
      conn,
      'https://getpocket.com/explore/item/are-birds-actually-real'
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
    const res = await fetchTopDomain(
      conn,
      'https://conspiracies.com/are-birds-actually-real'
    );
    sandbox.assert.calledOnceWithExactly(
      parserStub,
      'https://conspiracies.com/are-birds-actually-real'
    );
    sandbox.assert.calledOnceWithExactly(domainStub, conn, '999');
    expect(res).toEqual(1234);
  });
});
