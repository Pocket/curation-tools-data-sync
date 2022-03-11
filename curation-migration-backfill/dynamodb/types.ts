import { NativeAttributeValue } from '@aws-sdk/util-dynamodb';

export type CuratedItemRecord = {
  //curated feeds itemId in the readitla-tmp database
  curatedRecId: number;
  //externalId of the scheduledItem in the curatedCorpusApi
  scheduledItemExternalId: string;
  //externalId of the approvedItem in the curatedCorpusApi
  approvedItemExternalId: string;
  //last updated time in unix timestamp
  lastUpdatedAt: number;
  //feedName of the item - e.g NEW_TAB_EN_US
  scheduledSurfaceGuid: string;
};

// this is the structure of an `Item` as returned by dynamo
// just a convenience return type
export type DynamoItem =
  | {
      [key: string]: NativeAttributeValue;
    }
  | undefined;
