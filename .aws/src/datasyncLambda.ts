import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  LAMBDA_RUNTIMES,
  PocketEventBridgeWithLambdaTarget,
  PocketPagerDuty,
  PocketVPC,
} from '@pocket-tools/terraform-modules';

export class DatasyncLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    s3Bucket: string,
    pagerDuty?: PocketPagerDuty
  ) {
    super(scope, name);

    //const { sentryDsn, gitSha } = getEnvVariableValues(this);
    new PocketEventBridgeWithLambdaTarget(this, 'Backfill-Lambda', {
      name: `${config.prefix}-DataSync-Lambda`,
      eventRule: {
        description: 'curation migration - test event',
        //todo: create common event bus
        //eventBusName: `${config.prefix}-backfill-eventBus`,
        pattern: {
          eventType: ['curation-migration-datasync-test'],
        },
      },
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS14,
        handler: 'index.handler',
        timeout: 120,
        environment: {
          REGION: vpc.region,
          SENTRY_DSN: '',
          GIT_SHA: '',
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
        },
        vpcConfig: {
          securityGroupIds: vpc.defaultSecurityGroups.ids,
          subnetIds: vpc.privateSubnetIds,
        },
        codeDeploy: {
          region: vpc.region,
          accountId: vpc.accountId,
        },
        executionPolicyStatements: [
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
              `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:CurationToolsDataSync/${config.environment}`,
              `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:CurationToolsDataSync/${config.environment}/*`,
            ],
          },
        ],
        alarms: {
          //todo: set alarm
        },
      },
      tags: config.tags,
    });
  }
}
