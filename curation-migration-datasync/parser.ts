import fetch from 'node-fetch';
import config from './config';

/**
 * Fetch domainID from the parser by URL, to pull
 * top_domain from the DB for data sync process.
 * @param url the URL to fetch data for
 * @returns ParserMeadataResponse
 */
export async function getParsedDomainId(url: string): Promise<string> {
  const params = new URLSearchParams({
    output: 'regular',
    getItem: '1',
    images: '0',
    url: url,
  });
  const res = await fetch(config.parserEndpoint + '/' + params.toString());
  const jsonRes = await res.json();
  return jsonRes['item']['domain_id'];
}
