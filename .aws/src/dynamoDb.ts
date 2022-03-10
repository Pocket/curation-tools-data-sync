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
    return new ApplicationDynamoDBTable(this, `prospects`, {
      tags: config.tags,
      prefix: `${config.shortName}-${config.environment}-Prospects`,
      capacityMode: ApplicationDynamoDBTableCapacityMode.ON_DEMAND,
      tableConfig: {
        hashKey: 'curated_rec_id',
        writeCapacity: 5,
        readCapacity: 5,
        attribute: [
          {
            name: 'curated_rec_id',
            type: 'S',
          },
          {
            // externalId of the scheduledItem table in curatedCorpusApi
            name: 'externalIdScheduledItems',
            type: 'S',
          },
          {
            // externalId of the approvedItem table in curatedCorpusApi
            name: 'externalIdApprovedItems',
            type: 'S',
          },
        ],
        //for curatedItem datasync - we will get the externalId of the scheduledItems
        // then we can retrieve curated_rec_id from this index
        globalSecondaryIndex: [
          {
            name: 'scheduledItems-externalId',
            hashKey: 'externalIdScheduledItems',
            projectionType: 'ALL',
            readCapacity: 5,
            writeCapacity: 5,
          },
        ],
      },
    });
  }
}
