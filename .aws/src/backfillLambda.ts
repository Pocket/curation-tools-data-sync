import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { config } from './config';
import {
  ApplicationDynamoDBTable,
  LAMBDA_RUNTIMES,
  PocketPagerDuty,
  PocketSQSWithLambdaTarget,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { CloudwatchMetricAlarm } from '@cdktf/provider-aws/lib/cloudwatch-metric-alarm';
import { getEnvVariableValues } from './utilities';

export class BackfillLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    private curationMigrationTable: ApplicationDynamoDBTable,
    private pagerDuty?: PocketPagerDuty,
  ) {
    super(scope, name);

    const { sentryDsn, gitSha } = getEnvVariableValues(this);

    new PocketSQSWithLambdaTarget(this, 'sqs-integrated-backfill-lambda', {
      name: `${config.prefix}-Backfill-Lambda`,
      // set batchSize to something reasonable
      batchSize: 20,
      batchWindow: 60,
      sqsQueue: {
        visibilityTimeoutSeconds: 150,
        maxReceiveCount: 3,
      },
      functionResponseTypes: ['ReportBatchItemFailures'],
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS18,
        handler: 'index.handler',
        timeout: 120,
        environment: {
          CURATION_MIGRATION_TABLE: curationMigrationTable.dynamodb.name,
          CURATION_MIGRATION_TABLE_HASH_KEY:
            curationMigrationTable.dynamodb.hashKey,
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
            effect: 'Allow',
            actions: [
              'dynamodb:BatchWriteItem',
              'dynamodb:PutItem',
              'dynamodb:GetItem',
              'dynamodb:DescribeTable',
              'dynamodb:UpdateItem',
              'dynamodb:Query',
            ],
            resources: [
              curationMigrationTable.dynamodb.arn,
              `${curationMigrationTable.dynamodb.arn}/*`,
            ],
          },
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
              `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:${config.name}/${config.environment}`,
              `arn:aws:secretsmanager:${vpc.region}:${vpc.accountId}:secret:${config.name}/${config.environment}/*`,
            ],
          },
        ],
        alarms: {
          errors: {
            // The backfill lambda is throttled to concurrency of 10.
            evaluationPeriods: 1,
            comparisonOperator: 'GreaterThanOrEqualToThreshold',
            period: 1800, // 30 minutes
            // approx. 5% failure rate (taken from test runs on EN_INTL,
            // which is the shortest backfill run)
            threshold: 150,
            actions: config.isDev
              ? []
              : [pagerDuty!.snsNonCriticalAlarmTopic.arn],
          },
        },
      },
      tags: config.tags,
    });

    this.createDLQAlarm();
  }

  /**
   * Create an alarm for the Dead Letter Queue. This is the only place this is going
   * to be used so far - if it's ever reused, it should be moved to Terraform Modules.
   */
  createDLQAlarm() {
    return new CloudwatchMetricAlarm(this, 'backfill-dlq-alarm', {
      alarmName: config.prefix + '-Backfill-DLQ-Alarm',
      alarmDescription:
        'Alert on more than 5% of backfilled records ending up in the DLQ.',
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensions: {
        QueueName: config.prefix + '-Backfill-Lambda-Queue-Deadletter',
      },
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      evaluationPeriods: 1,
      // 5 minutes
      period: 300,
      // approx 5% of the records to be processed (86K)
      threshold: 4000,
      // rather than the average, we want to track how many messages in total end up in the DLQ
      statistic: 'Sum',
      alarmActions: [this.pagerDuty?.snsNonCriticalAlarmTopic.arn],
      okActions: [this.pagerDuty?.snsNonCriticalAlarmTopic.arn],
    });
  }
}
