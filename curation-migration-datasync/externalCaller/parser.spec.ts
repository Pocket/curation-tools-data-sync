import nock from 'nock';
import { getParserMetadata, parser } from './parser';
import config from '../config';

describe('getParsedDomainId', () => {
  const testError = 'Something went wrong';
  const testUrl = 'myurl.com';
  const data = { resolved_id: '1', item: { domain_id: '124' } };
  const params = new URLSearchParams({
    output: 'regular',
    getItem: '1',
    images: '0',
    url: 'myurl.com',
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches appropriate keys from response', async () => {
    nock(config.parserEndpoint).get('/').query(params).reply(200, data);

    const res = await getParserMetadata('myurl.com');
    expect(res).toEqual({ domainId: '124', resolvedId: '1' });
  });

  it('should throw error after retrying three times', async () => {
    const parserCallerSpy = jest.spyOn(parser, 'parserCaller');
    nock(config.parserEndpoint)
      .get('/')
      .query(params)
      .times(3)
      .replyWithError(testError);

    await expect(getParserMetadata('myurl.com')).rejects.toThrowError(
      `request to ${
        config.parserEndpoint
      }/?${params.toString()} failed, reason: ${testError}`
    );
    expect(parserCallerSpy).toBeCalledTimes(3);
  });

  it('should succeed if the third attempt succeed', async () => {
    const parserCallerSpy = jest.spyOn(parser, 'parserCaller');
    nock(config.parserEndpoint)
      .get('/')
      .query(params)
      .times(2)
      .replyWithError(testError);
    nock(config.parserEndpoint).get('/').query(params).reply(200, data);

    const res = await getParserMetadata(testUrl);
    expect(res).toEqual({ domainId: '124', resolvedId: '1' });
    expect(parserCallerSpy).toBeCalledTimes(3);
  });
});
