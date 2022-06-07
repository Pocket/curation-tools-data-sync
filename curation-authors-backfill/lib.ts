import { ApprovedItemAuthor } from './types';

// ୧༼ ಠ益ಠ ༽୨  aws and their old node runtimes
export const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * parses a CSV of authors and returns an array of valid authors
 */
export const parseAuthorsCsv = (
  authorsCsv: string
): ApprovedItemAuthor[] | [] => {
  // get an array of authors
  const rawAuthors = authorsCsv.split(',');
  const validAuthors: ApprovedItemAuthor[] = [];

  rawAuthors.forEach((rawAuthor, index) => {
    // get rid of whitespace
    const author = rawAuthor.trim();

    // assuming author is not an empty string, check for HTML tags
    if (author.length) {
      if (!(author.startsWith('<') && author.endsWith('>'))) {
        // if author doesn't begin and end with an HTML bracket, we consider it valid
        validAuthors.push({
          name: author,
          sortOrder: index + 1,
        });
      }
    }
  });

  return validAuthors;
};
