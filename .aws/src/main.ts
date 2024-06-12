import { Construct } from 'constructs';
import {
  App,
  S3Backend,
  TerraformStack,
} from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { config } from './config';
import { PocketVPC } from '@pocket-tools/terraform-modules';
import { LocalProvider } from '@cdktf/provider-local/lib/provider';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { ArchiveProvider } from '@cdktf/provider-archive/lib/provider';
import { BackfillLambda } from './backfillLambda';
import { DynamoDB } from './dynamoDb';
import { DatasyncLambda } from './datasyncLambda';
import { BackfillAuthorsLambda } from './backfillAuthorsLambda';

class CurationToolsDataSync extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', { region: 'us-east-1' });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');
    new ArchiveProvider(this, 'archive_provider');

    new S3Backend(this, {
      bucket: `mozilla-content-team-${config.environment.toLowerCase()}-terraform-state`,
      dynamodbTable: `mozilla-content-team-${config.environment.toLowerCase()}-terraform-state`,
      key: config.name,
      region: 'us-east-1',
    });

    // ** shared infrastructure between backfill and datasync
    const vpc = new PocketVPC(this, 'pocket-shared-vpc');
    //dynamo db to map curatedRecId - scheduledItem's externalId and store approvedItem's externalId
    const idMapperDynamoDb = new DynamoDB(this, 'curation-migration-id-mapper');

    // ** infrastructure for backfill process **
    //bucket for storing all the required csv files
    this.createMigrationBucket();

    new BackfillAuthorsLambda(this, 'backfill-author-lambda', vpc);

    new BackfillLambda(
      this,
      'backfill-lambda',
      vpc,
      idMapperDynamoDb.curationMigrationTable,
    );

    // ** infrastructure for datasync process **
    new DatasyncLambda(
      this,
      'datasync-lambda',
      vpc,
      idMapperDynamoDb.curationMigrationTable,
    );
  }

  /**
   * Create the migration S3 bucket
   * This bucket is used to store all the required csv files
   * @private
   */
  private createMigrationBucket() {
    return new S3Bucket(this, 'synthetic-s3-bucket', {
      bucket:
        `pocket-curation-migration-${config.environment}-backfill-bucket`.toLowerCase(),
      tags: config.tags,
      acl: 'private',
    });
  }
}

const app = new App();
new CurationToolsDataSync(app, config.domainPrefix);
app.synth();
