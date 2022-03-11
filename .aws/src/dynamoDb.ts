import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  ApplicationDynamoDBTable,
  ApplicationDynamoDBTableCapacityMode,
} from '@pocket-tools/terraform-modules';

/**
 * dynamoDb to map the curated_rec_id in the readitla-* database
 * and externalId of the scheduledItem and externalId of the ApprovedItem
 */
export class DynamoDB extends Resource {
  public readonly curationMigrationTable: ApplicationDynamoDBTable;

  constructor(scope: Construct, name: string) {
    super(scope, name);
    this.curationMigrationTable = this.setupCurationMigrationTable();
  }

  /**
   * Sets up the dynamodb table where the prospects will live
   * @private
   */
  private setupCurationMigrationTable() {
    // note that this config is mirrored in .docker/localstack/dynamodb/
    // if config changes here, that file should also be updated
    return new ApplicationDynamoDBTable(this, `curation-migration`, {
      tags: config.tags,
      prefix: `${config.shortName}-${config.environment}`,
      capacityMode: ApplicationDynamoDBTableCapacityMode.ON_DEMAND,
      tableConfig: {
        hashKey: 'curated_rec_id',
        attribute: [
          {
            name: 'curated_rec_id',
            type: 'S',
          },
          //feedName of the item - e.g NEW_TAB_EN_US, incase we need to filter by feed type (for rollbacks)
          {
            name: 'scheduledSurfaceGuid',
            type: 'S',
          },
          {
            // externalId of the scheduledItem table in curatedCorpusApi
            name: 'scheduledItemExternalId',
            type: 'S',
          },
          //todo: can we use lastUpdatedAt as range key when all the partition key are different?
          // {
          // TODO: having approvedItemExternalId as index would be useful if we need to rollback a particular item.
          //in this case, can we make the approvedItemExternalId secondary index
          //   name: 'approvedItemExternalId',
          //   type: 'S',
          // },
          // {
          //   // last updated unix timestamp, incase we need to filter by last updated date (for rollbacks)
          //   name: 'lastUpdated',
          //   type: 'N',
          // },
        ],
        //for curatedItem datasync - we will get the externalId of the scheduledItems
        // then we can retrieve curated_rec_id from this index
        globalSecondaryIndex: [
          {
            name: 'scheduledItemExternalId-GSI',
            hashKey: 'scheduledItemExternalId',
            projectionType: 'ALL',
          },
          {
            name: 'scheduledSurfaceGuid-GSI',
            hashKey: 'scheduledSurfaceGuid',
            projectionType: 'ALL',
          },
        ],
      },
    });
  }
}
