import nock from 'nock';
import { getParsedDomainId } from './parser';
import config from './config';

describe('getParsedDomainId', () => {
  it('fetches appropriate keys from response', async () => {
    const data = { resolved_id: '1', item: { domain_id: '124' } };
    const params = new URLSearchParams({
      output: 'regular',
      getItem: '1',
      images: '0',
      url: 'myurl.com',
    });
    nock(config.parserEndpoint)
      .get('/' + params.toString())
      .reply(200, data);

    const res = await getParsedDomainId('myurl.com');
    expect(res).toEqual('124');
  });
});
