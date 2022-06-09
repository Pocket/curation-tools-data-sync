import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  LAMBDA_RUNTIMES,
  PocketPagerDuty,
  PocketSQSWithLambdaTarget,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { getEnvVariableValues } from './utilities';

export class BackfillAuthorsLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    private pagerDuty?: PocketPagerDuty
  ) {
    super(scope, name);

    const { sentryDsn, gitSha } = getEnvVariableValues(this);

    new PocketSQSWithLambdaTarget(
      this,
      'sqs-integrated-backfill-author-lambda',
      {
        name: `${config.prefix}-Backfill-Author-Lambda`,
        // set batchSize to something reasonable
        batchSize: 20,
        batchWindow: 60,
        sqsQueue: {
          visibilityTimeoutSeconds: 150,
          maxReceiveCount: 3,
        },
        functionResponseTypes: ['ReportBatchItemFailures'],
        lambda: {
          runtime: LAMBDA_RUNTIMES.NODEJS14,
          handler: 'index.handler',
          timeout: 120,
          environment: {
            REGION: vpc.region,
            SENTRY_DSN: sentryDsn,
            GIT_SHA: gitSha,
            JWT_KEY: `${config.name}/${config.environment}/JWT_KEY`,
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
                `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:${config.name}/${config.environment}`,
                `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:${config.name}/${config.environment}/*`,
              ],
            },
          ],
          alarms: {
            // TODO: Do we need this at all?
            errors: {
              // The backfill lambda is throttled to concurrency of 10.
              evaluationPeriods: 1,
              comparisonOperator: 'GreaterThanOrEqualToThreshold',
              period: 1800, // 30 minutes
              // approx. 5% failure rate (taken from test runs on EN_INTL,
              // which is the shortest backfill run)
              threshold: 150,
              actions: [],
            },
          },
        },
        tags: config.tags,
      }
    );
  }
}
