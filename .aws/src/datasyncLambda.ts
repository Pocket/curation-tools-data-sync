import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import {
  ApplicationDynamoDBTable,
  ApplicationRDSCluster,
  ApplicationSQSQueue,
  LAMBDA_RUNTIMES,
  PocketEventBridgeProps,
  PocketEventBridgeRuleWithMultipleTargets,
  PocketEventBridgeTargets,
  PocketPagerDuty,
  PocketSQSWithLambdaTarget,
  PocketSQSWithLambdaTargetProps,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { CloudwatchMetricAlarm } from '@cdktf/provider-aws/lib/cloudwatch-metric-alarm';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { SqsQueue } from '@cdktf/provider-aws/lib/sqs-queue';
import { DataAwsSqsQueue } from '@cdktf/provider-aws/lib/data-aws-sqs-queue';
import { SqsQueuePolicy } from '@cdktf/provider-aws/lib/sqs-queue-policy';
import { getEnvVariableValues } from './utilities';
import { config } from './config';

export class DatasyncLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    private curationMigrationTable: ApplicationDynamoDBTable,
    private pagerDuty?: PocketPagerDuty,
  ) {
    super(scope, name);

    this.createEventBridgeRuleWithSQSLambdaTarget();
  }

  /**
   * Creates an event bridge rule with an SQS+Lambda target
   * @private
   */
  private createEventBridgeRuleWithSQSLambdaTarget() {
    const target = this.createSQSLambdaTarget();

    const eventBridgeDLQ = this.createSqsForDlq();

    const eventBridgeTarget: PocketEventBridgeTargets = {
      targetId: `${config.prefix}-Datasync-Target-SQS-Id`,
      arn: target.sqsQueueResource.arn,
      terraformResource: target.sqsQueueResource as SqsQueue,
      deadLetterArn: eventBridgeDLQ.arn,
    };

    const dataSyncEventRuleConfig: PocketEventBridgeProps = {
      eventRule: {
        name: `${config.prefix}-EventBridge-Rule`,
        eventPattern: {
          source: ['curation-migration-datasync'],
          'detail-type': [
            'add-scheduled-item',
            'update-scheduled-item',
            'update-approved-item',
            'remove-scheduled-item',
          ],
        },
        //todo: this has to be created as seperate app construct in tf module
        //if we need custom bus
        //eventBusName: '${config.prefix}-datasync-event-bus',
      },
      targets: [{ ...eventBridgeTarget }],
    };

    const dataSyncEventRuleWithTargetObj =
      new PocketEventBridgeRuleWithMultipleTargets(
        this,
        `${config.prefix}-EventBridge-Rule`,
        dataSyncEventRuleConfig,
      );

    // Permissions for EventBridge publishing to SQS Target and DLQ (if fail to send)
    this.createPolicyForEventBridgeRuleToSQS(
      'DLQ',
      eventBridgeDLQ,
      dataSyncEventRuleWithTargetObj.getEventBridge().rule.arn,
    );
    this.createPolicyForEventBridgeRuleToSQS(
      'Datasync-SQS',
      target.sqsQueueResource,
      dataSyncEventRuleWithTargetObj.getEventBridge().rule.arn,
    );
  }

  /**
   * Create an SQS queue to be used as a DLQ for the event bridge target
   * @private
   */
  private createSqsForDlq() {
    const dlq = new SqsQueue(this, 'datasync-target-lambda-dlq', {
      name: `${config.prefix}-Datasync-Lambda-DLQ`,
    });

    this.creatEventBridgeDlqAlarm(dlq);

    return dlq;
  }

  /**
   * @private
   */
  private createSQSLambdaTarget() {
    /**
     * Create an RDS instance if we are working in the Dev account.
     * This is only to facilitate testing
     */
    let rdsCluster: ApplicationRDSCluster;
    if (config.isDev) {
      rdsCluster = this.createRds();
    }

    const { sentryDsn, gitSha, parserEndpoint } = getEnvVariableValues(this);

    // Conditionally build secrets depending on environment
    const secretResources = [
      `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}`,
      `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}/*`,
    ];
    // Add the ARN to the RDS cluster if in dev
    if (config.isDev) {
      secretResources.push(rdsCluster.secretARN);
    }

    const lambdaConfig: PocketSQSWithLambdaTargetProps = {
      name: `${config.prefix}-Datasync-Lambda`,
      sqsQueue: {
        visibilityTimeoutSeconds: 150,
        maxReceiveCount: 3,
      },
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS18,
        handler: 'index.handler',
        timeout: 120,
        vpcConfig: {
          securityGroupIds: this.vpc.defaultSecurityGroups.ids,
          subnetIds: this.vpc.privateSubnetIds,
        },
        codeDeploy: {
          region: this.vpc.region,
          accountId: this.vpc.accountId,
        },
        environment: {
          CURATION_MIGRATION_TABLE: this.curationMigrationTable.dynamodb.name,
          CURATION_MIGRATION_TABLE_HASH_KEY:
            this.curationMigrationTable.dynamodb.hashKey,
          READ_DATABASE_SECRET_ID:
            config.environment === 'Prod'
              ? config.datasyncLambda.readDbSecretId
              : rdsCluster.secretARN, // Can fetch by either ID or ARN; pass ARN if we created RDS resource
          WRITE_DATABASE_SECRET_ID:
            config.environment === 'Prod'
              ? config.datasyncLambda.writeDbSecretId
              : rdsCluster.secretARN,
          REGION: this.vpc.region,
          SENTRY_DSN: sentryDsn,
          GIT_SHA: gitSha,
          PARSER_ENDPOINT: parserEndpoint,
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
          ALLOW_FEEDS: config.datasyncLambda.allowFeeds,
        },
        executionPolicyStatements: [
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: secretResources,
          },
          {
            effect: 'Allow',
            actions: [
              'dynamodb:BatchWriteItem',
              'dynamodb:BatchGetItem',
              'dynamodb:PutItem',
              'dynamodb:GetItem',
              'dynamodb:DescribeTable',
              'dynamodb:UpdateItem',
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:DeleteItem',
              'dynamodb:ConditionCheckItem',
            ],
            resources: [
              this.curationMigrationTable.dynamodb.arn,
              `${this.curationMigrationTable.dynamodb.arn}/*`,
            ],
          },
        ],
      },
    };
    const sqsLambda = new PocketSQSWithLambdaTarget(
      this,
      `${config.prefix}-Datasync-Lambda`,
      lambdaConfig,
    );

    this.createSqsLambdaDlqAlarm(sqsLambda.applicationSqsQueue);

    return sqsLambda;
  }

  /**
   * Create an alarm for the Event Bridge DLQ to monitor the number
   * of messages that did not make it to the queue.
   * Starting with 5 as a base. Update as needed.
   * This is a critical service, ideally, there shouldn't be any failed
   * sends/messages from event bridge in the DLQ.
   * @param queue
   * @private
   */
  private creatEventBridgeDlqAlarm(queue: SqsQueue) {
    this.createSqsAlarm(queue.name, 'EventBridgeDLQ-Alarm');
  }

  /**
   * Create an alarm for the SQS Lambda integration DLQ to monitor the number
   * of messages that did not make it to the queue.
   * Starting with 5 as a base. Update as needed.
   * This is a critical service, ideally, there shouldn't be any failed
   * events/errors from the lambda to its DLQ.
   * @param applicationSqsQueue
   * @private
   */
  private createSqsLambdaDlqAlarm(applicationSqsQueue: ApplicationSQSQueue) {
    this.createSqsAlarm(
      applicationSqsQueue.deadLetterQueue.name,
      'SQS-Lambda-DLQ-Alarm',
    );
  }

  /**
   * Create a critical SQS queue alarm based on the number of messages visible
   * @param queueName
   * @param alarmName
   * @param evaluationPeriods
   * @param period
   * @param threshold
   * @private
   */
  private createSqsAlarm(
    queueName,
    alarmName,
    evaluationPeriods = 1,
    period = 300,
    threshold = 5,
  ) {
    new CloudwatchMetricAlarm(this, alarmName.toLowerCase(), {
      alarmName: `${config.prefix}-${alarmName}`,
      alarmDescription: `Number of messages >= ${threshold}`,
      namespace: 'AWS/SQS',
      metricName: 'ApproximateNumberOfMessagesVisible',
      dimensions: { QueueName: queueName },
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      evaluationPeriods: evaluationPeriods,
      period: period,
      threshold: threshold,
      statistic: 'Sum',
      alarmActions: [],
      okActions: [],
    });
  }

  /**
   * Reference: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-dlq.html
   * @param name
   * @param sqsQueue
   * @param eventBridgeRuleArn
   * @private
   */
  private createPolicyForEventBridgeRuleToSQS(
    name: string,
    sqsQueue: SqsQueue | DataAwsSqsQueue,
    eventBridgeRuleArn: string,
  ) {
    const eventBridgeRuleSQSPolicy = new DataAwsIamPolicyDocument(
      this,
      `${config.prefix}-EventBridge-${name}-Policy`,
      {
        statement: [
          {
            effect: 'Allow',
            actions: ['sqs:SendMessage'],
            resources: [sqsQueue.arn],
            principals: [
              {
                identifiers: ['events.amazonaws.com'],
                type: 'Service',
              },
            ],
            condition: [
              {
                test: 'ArnEquals',
                variable: 'aws:SourceArn',
                values: [eventBridgeRuleArn],
              },
            ],
          },
        ],
      },
    ).json;

    return new SqsQueuePolicy(this, `${name.toLowerCase()}-policy`, {
      queueUrl: sqsQueue.url,
      policy: eventBridgeRuleSQSPolicy,
    });
  }

  /**
   * Creates a serverless aurora RDS.
   * This function should only be uses when the environment is Dev
   * @private
   */
  private createRds() {
    return new ApplicationRDSCluster(this, 'dev-aurora', {
      prefix: `${config.prefix}-v1`,
      vpcId: this.vpc.vpc.id,
      subnetIds: this.vpc.privateSubnetIds,
      rdsConfig: {
        databaseName: config.name.toLowerCase(),
        masterUsername: 'pkt_curation_data_sync',
        skipFinalSnapshot: true,
        engine: 'aurora-mysql',
        engineMode: 'serverless',
        scalingConfiguration: {
          minCapacity: config.rds.minCapacity,
          maxCapacity: config.rds.maxCapacity,
          autoPause: false,
        },
        deletionProtection: false,
      },

      tags: config.tags,
    });
  }
}
