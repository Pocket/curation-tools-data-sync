import { backOff } from 'exponential-backoff';
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
export const parser = {
  parserCaller: async (url: string): Promise<ParserMetadataResponse> => {
    const params = new URLSearchParams({
      output: 'regular',
      getItem: '1',
      images: '0',
      url: url,
    });
    const res = await fetch(config.parserEndpoint + '/' + params.toString());
    const jsonRes = (await res.json()) as any;
    return {
      domainId: jsonRes['item']['domain_id'],
      resolvedId: jsonRes['resolved_id'],
    };
  },
};

/**
 * calls parser to fetch domainID and resolvedId.
 * Retries for max 3 times with backoff.
 * https://www.npmjs.com/package/exponential-backoff#ibackoffoptions
 * @param url
 */
export async function getParserMetadata(
  url: string
): Promise<ParserMetadataResponse> {
  const backOffOptions = {
    numOfAttempts: 3, //default is 10
  };

  return (await backOff(
    () => parser.parserCaller(url),
    backOffOptions
  )) as ParserMetadataResponse;
}
