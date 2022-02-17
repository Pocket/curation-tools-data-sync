import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  LAMBDA_RUNTIMES,
  PocketEventBridgeWithLambdaTarget,
  PocketPagerDuty,
  PocketVPC,
} from '@pocket-tools/terraform-modules';

export class BackfillLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    pagerDuty?: PocketPagerDuty
  ) {
    super(scope, name);

    //const { sentryDsn, gitSha } = getEnvVariableValues(this);

    //note: because this is one time migration,
    //we will just use the default event bus.
    new PocketEventBridgeWithLambdaTarget(this, 'Backfill-Lambda', {
      name: `${config.prefix}-Backfill-Lambda`,
      eventRule: {
        description: 'curation migration - event to initiate backfill',
        //todo: create common event bus
        //eventBusName: `${config.prefix}-backfill-eventBus`,
        pattern: {
          eventType: ['curation-migration-backfill'],
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
            //todo: add permission to access S3 bucket
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
