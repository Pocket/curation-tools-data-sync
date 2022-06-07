// structure of each message in SQS
export interface SqsBackfillMessage {
  externalId: string;
  title: string;
  url: string;
  publisher: string;
}

// the structure of an approved item author
export type ApprovedItemAuthor = {
  name: string;
  sortOrder: number;
};

// input required by the mutation to update an approved item with authors data
export interface ApprovedItemAuthorsInput {
  externalId: string;
  authors: ApprovedItemAuthor[];
}

// return type when calling prospect API to retrieve authors metadata
export type ApprovedItemAuthorsInfo = {
  authors: string; // will be a CSV of authors
};

export type UpdateApprovedCorpusItemAuthorsPayload = {
  externalId: string;
  url: string;
  title: string;
  authors: ApprovedItemAuthor[];
};

export interface UpdateApprovedCorpusItemAuthorsMutationResponse {
  data: {
    updateApprovedCorpusItemAuthors: UpdateApprovedCorpusItemAuthorsPayload;
  };
}
