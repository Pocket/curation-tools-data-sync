import {
  DeleteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import config from '../config';

/**
 * test helper method for integration tests
 *
 * note - this will only delete a max of 1MB of data, but we should never
 * hit that in our integration tests
 */
export const truncateDynamoDb = async (
  dbClient: DynamoDBDocumentClient
): Promise<void> => {
  const rows = await scanAllRows(dbClient);

  const items = rows.Items as any;
  for (const r of items) {
    await dbClient.send(
      new DeleteCommand({
        TableName: config.aws.dynamoDB.curationMigrationTable,
        Key: {
          curatedRecId: r.curatedRecId,
        },
      })
    );
  }
};

/**
 * test helper method for integration tests. essentially a way to retrieve all
 * rows in the database - for counting or truncating.
 *
 * @returns ScanCommandOutput - object containing, among other things, an
 * array of Items
 */
export const scanAllRows = async (
  dbClient: DynamoDBDocumentClient
): Promise<ScanCommandOutput> => {
  return await dbClient.send(
    new ScanCommand({
      TableName: config.aws.dynamoDB.curationMigrationTable,
      AttributesToGet: [config.aws.dynamoDB.curatedRecIdHashKey],
    })
  );
};
