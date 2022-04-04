import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import {
  ApplicationDynamoDBTable,
  ApplicationRDSCluster,
  LAMBDA_RUNTIMES,
  PocketEventBridgeProps,
  PocketEventBridgeRuleWithMultipleTargets,
  PocketEventBridgeTargets,
  PocketSQSWithLambdaTarget,
  PocketSQSWithLambdaTargetProps,
  PocketPagerDuty,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { iam, lambdafunction, sqs } from '@cdktf/provider-aws';
import { getEnvVariableValues } from './utilities';
import { config } from './config';
import { LambdaPermissionConfig } from '@cdktf/provider-aws/lib/lambdafunction';

export class DatasyncLambda extends Resource {
  constructor(
    scope: Construct,
    private name: string,
    private vpc: PocketVPC,
    private curationMigrationTable: ApplicationDynamoDBTable,
    pagerDuty?: PocketPagerDuty
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
      terraformResource: target.sqsQueueResource as sqs.SqsQueue,
      deadLetterArn: eventBridgeDLQ.arn,
    };

    const dataSyncEventRuleConfig: PocketEventBridgeProps = {
      eventRule: {
        name: `${config.prefix}-EventBridge-Rule`,
        pattern: {
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
        dataSyncEventRuleConfig
      );

    const dataSyncEventRule = dataSyncEventRuleWithTargetObj.getEventBridge();

    new lambdafunction.LambdaPermission(
      this,
      `${config.prefix}-Datasync-Lambda-Permission`,
      {
        action: 'lambda:InvokeFunction',
        functionName: target.lambda.versionedLambda.functionName,
        qualifier: target.lambda.versionedLambda.name,
        principal: 'events.amazonaws.com',
        sourceArn: dataSyncEventRule.rule.arn,
        dependsOn: [target.lambda.versionedLambda, dataSyncEventRule.rule],
      } as LambdaPermissionConfig
    );

    // Permissions for EventBridge publishing to SQS Target and DLQ (if fail to send)
    this.createPolicyForEventBridgeRuleToSQS(
      'DLQ',
      eventBridgeDLQ,
      dataSyncEventRuleWithTargetObj.getEventBridge().rule.arn
    );
    this.createPolicyForEventBridgeRuleToSQS(
      'Datasync-SQS',
      target.sqsQueueResource,
      dataSyncEventRuleWithTargetObj.getEventBridge().rule.arn
    );
  }

  /**
   * Create an SQS queue to be used as a DLQ for the event bridge target
   * @private
   */
  private createSqsForDlq() {
    return new sqs.SqsQueue(this, 'datasync-target-lambda-dlq', {
      name: `${config.prefix}-Datasync-Lambda-DLQ`,
    });
  }

  /**
   * @private
   */
  private createSQSLambdaTarget() {
    /**
     * Create an RDS instance if we are working in the Dev account.
     * This is only to facilitate testing
     */
    if (config.isDev) {
      this.createRds();
    }

    const { sentryDsn, gitSha, parserEndpoint } = getEnvVariableValues(this);

    const lambdaConfig: PocketSQSWithLambdaTargetProps = {
      name: `${config.prefix}-Datasync-Lambda`,
      sqsQueue: {
        visibilityTimeoutSeconds: 150,
        maxReceiveCount: 1,
      },
      lambda: {
        runtime: LAMBDA_RUNTIMES.NODEJS14,
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
          DATABASE_SECRET_ID: config.datasyncLambda.dbSecretId,
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
            resources: [
              `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}`,
              `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}/*`,
            ],
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
    return new PocketSQSWithLambdaTarget(
      this,
      `${config.prefix}-Datasync-Lambda`,
      lambdaConfig
    );
  }

  /**
   * Reference: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-dlq.html
   * @param sqsQueue
   * @param eventBridgeRuleArn
   * @private
   */
  private createPolicyForEventBridgeRuleToSQS(
    name: string,
    sqsQueue: sqs.SqsQueue | sqs.DataAwsSqsQueue,
    eventBridgeRuleArn: string
  ) {
    const eventBridgeRuleSQSPolicy = new iam.DataAwsIamPolicyDocument(
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
      }
    ).json;

    return new sqs.SqsQueuePolicy(this, `${name.toLowerCase()}-policy`, {
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
