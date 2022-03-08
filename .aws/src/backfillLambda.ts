import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  ApplicationSQSQueue,
  LAMBDA_RUNTIMES,
  PocketPagerDuty,
  PocketSQSWithLambdaTarget,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { getEnvVariableValues } from './utilities';
import { SqsQueue } from '@cdktf/provider-aws';

export class BackfillLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    private sqsQueue: SqsQueue,
    pagerDuty?: PocketPagerDuty
  ) {
    super(scope, name);

    const { sentryDsn, gitSha } = getEnvVariableValues(this);

    new PocketSQSWithLambdaTarget(this, 'sqs-integrated-backfill-lambda', {
      name: `${config.prefix}-Backfill-Lambda`,
      // set batchSize to something reasonable
      batchSize: 25,
      batchWindow: 60,
      configFromPreexistingSqsQueue: {
        name: sqsQueue.name,
      },
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS14,
        handler: 'index.handler',
        timeout: 120,
        environment: {
          REGION: vpc.region,
          SENTRY_DSN: sentryDsn,
          GIT_SHA: gitSha,
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
          // TODO: set better alarm values
        },
      },
      tags: config.tags,
    });
  }
}
