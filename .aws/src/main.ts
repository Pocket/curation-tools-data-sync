import { Construct } from 'constructs';
import {
  App,
  DataTerraformRemoteState,
  RemoteBackend,
  TerraformStack,
} from 'cdktf';
import {
  AwsProvider,
  DataAwsCallerIdentity,
  DataAwsRegion,
  S3Bucket,
} from '@cdktf/provider-aws';

import { config } from './config';
import { PocketPagerDuty, PocketVPC } from '@pocket-tools/terraform-modules';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty';
import { LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null';
import { ArchiveProvider } from '@cdktf/provider-archive';
import { BackfillLambda } from './backfillLambda';

//todo: change class name to your service name
class Acme extends TerraformStack {
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

    const region = new DataAwsRegion(this, 'region');
    const caller = new DataAwsCallerIdentity(this, 'caller');

    const vpc = new PocketVPC(this, 'pocket-shared-vpc');
    const pagerDuty = this.createPagerDuty();

    const s3Bucket = this.createMigrationBucket();
    //todo: create custom event bus and add it to backfill lambda
    new BackfillLambda(this, 'proxy-lambda', vpc, pagerDuty);
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
      }
    );

    return new PocketPagerDuty(this, 'pagerduty', {
      prefix: config.prefix,
      service: {
        criticalEscalationPolicyId: incidentManagement.get(
          'policy_backend_critical_id'
        ),
        nonCriticalEscalationPolicyId: incidentManagement.get(
          'policy_backend_non_critical_id'
        ),
      },
    });
  }

  private createMigrationBucket() {
    const migrationBucket = new S3Bucket(this, 'synthetic-s3-bucket', {
      //todo: env is using `prod` here - investigate
      bucket: `Pocket-curation-migration-backfill-bucket`.toLowerCase(),
      tags: config.tags,
      acl: 'private',
    });

    //todo: make bucket as private.

    return migrationBucket;
  }
}

const app = new App();
new Acme(app, 'curation-migration-backfill');
app.synth();
