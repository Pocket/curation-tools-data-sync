import config from '../config';
import fetch from 'node-fetch';

type ParserMetadataResponse = {
  resolvedId: string;
  domainId: string;
};

/**
 * Fetch domainID and resolvedID from the parser service,
 * using the URL.
 * @param url the URL to fetch data for
 * @returns ParserMetadataResponse
 */
export async function parserCaller(
  url: string
): Promise<ParserMetadataResponse> {
  const params = new URLSearchParams({
    output: 'regular',
    getItem: '1',
    images: '0',
    url: url,
  });
  const res = await fetch(config.parserEndpoint + '/' + params.toString());
  const jsonRes = await res.json();
  return {
    domainId: jsonRes['item']['domain_id'],
    resolvedId: jsonRes['resolved_id'],
  };
}
