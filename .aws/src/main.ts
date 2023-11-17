import { Construct } from 'constructs';
import {
  App,
  DataTerraformRemoteState,
  RemoteBackend,
  TerraformStack,
} from 'cdktf';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { config } from './config';
import { PocketPagerDuty, PocketVPC } from '@pocket-tools/terraform-modules';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty/lib/provider';
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
    new PagerdutyProvider(this, 'pagerduty_provider', { token: undefined });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');
    new ArchiveProvider(this, 'archive_provider');

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: 'Pocket',
      workspaces: [{ prefix: `${config.name}-` }],
    });

    // ** shared infrastructure between backfill and datasync
    const vpc = new PocketVPC(this, 'pocket-shared-vpc');
    const pagerDuty = this.createPagerDuty();
    //dynamo db to map curatedRecId - scheduledItem's externalId and store approvedItem's externalId
    const idMapperDynamoDb = new DynamoDB(this, 'curation-migration-id-mapper');

    // ** infrastructure for backfill process **
    //bucket for storing all the required csv files
    this.createMigrationBucket();

    new BackfillAuthorsLambda(this, 'backfill-author-lambda', vpc, pagerDuty);

    new BackfillLambda(
      this,
      'backfill-lambda',
      vpc,
      idMapperDynamoDb.curationMigrationTable,
      pagerDuty,
    );

    // ** infrastructure for datasync process **
    new DatasyncLambda(
      this,
      'datasync-lambda',
      vpc,
      idMapperDynamoDb.curationMigrationTable,
      pagerDuty,
    );
  }

  /**
   * Create PagerDuty service for alerts
   * @private
   */
  private createPagerDuty() {
    // don't create any pagerduty resources if in dev
    if (config.isDev) {
      return undefined;
    }

    const incidentManagement = new DataTerraformRemoteState(
      this,
      'incident_management',
      {
        organization: 'Pocket',
        workspaces: {
          name: 'incident-management',
        },
      },
    );

    return new PocketPagerDuty(this, 'pagerduty', {
      prefix: config.prefix,
      service: {
        criticalEscalationPolicyId: incidentManagement
          .get('policy_default_critical_id')
          .toString(),
        nonCriticalEscalationPolicyId: incidentManagement
          .get('policy_default_non_critical_id')
          .toString(),
      },
    });
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
