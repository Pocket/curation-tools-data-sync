import { backOff } from 'exponential-backoff';
import { parserCaller } from './parserCaller';

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
    res = await backOff(() => parserCaller(url), backOffOptions);
    console.log(res);
  } catch (e) {
    throw new Error(e);
  }
  return res;
}
