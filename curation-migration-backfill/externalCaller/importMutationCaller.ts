import {
  CorpusInput,
  ImportApprovedCorpusItemMutationResponse,
} from '../types';
import { backOff } from 'exponential-backoff';
import { importApprovedCorpusItem } from './curatedCorpusApiCaller';

/**
 * Function that establishes the number of back off attempts
 * and calls the importApprovedCorpusItem function. Catches and throws any errors
 * as well as errors thrown by the mutation call
 */
export async function callImportMutation(
  data: CorpusInput,
): Promise<ImportApprovedCorpusItemMutationResponse> {
  // we've set the default number of retries to 3
  const backOffOptions = {
    numOfAttempts: 3,
  };

  let res: any;

  try {
    // call our mutation function
    res = await backOff(() => importApprovedCorpusItem(data), backOffOptions);
    if (res.errors != null) {
      throw new Error(
        `Failed to retrieve data from curated-corpus-api.\n GraphQL Errors: ${JSON.stringify(
          res.errors,
        )}`,
      );
    }
  } catch (e) {
    throw new Error(e);
  }
  return res;
}
