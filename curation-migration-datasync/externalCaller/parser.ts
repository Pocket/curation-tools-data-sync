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
    const jsonRes = await res.json();
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
export async function getParserMetadata(url: string): Promise<any> {
  const backOffOptions = {
    numOfAttempts: 3, //default is 10
  };

  //backoff doesn't allow us to type the response, but its enforced in parserCaller()
  let res: any;
  try {
    res = await backOff(() => parser.parserCaller(url), backOffOptions);
    console.log(res);
  } catch (e) {
    throw new Error(e);
  }
  return res;
}
