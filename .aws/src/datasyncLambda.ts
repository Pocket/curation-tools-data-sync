import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import {
  ApplicationDynamoDBTable,
  ApplicationRDSCluster,
  LAMBDA_RUNTIMES,
  PocketEventBridgeProps,
  PocketEventBridgeRuleWithMultipleTargets,
  PocketEventBridgeTargets,
  PocketPagerDuty,
  PocketVersionedLambda,
  PocketVersionedLambdaProps,
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

    this.createEventBridgeRuleWithLambdaTargetAndDLQ();
  }

  /**
   * Creates an event bridge rule with a lambda target
   * @private
   */
  private createEventBridgeRuleWithLambdaTargetAndDLQ() {
    const targetLambda = this.createLambdaTarget();

    const targetLambdaDLQ = this.createSqsForDlq();

    const eventBridgeTarget: PocketEventBridgeTargets = {
      targetId: `${config.prefix}-Datasync-Target-Lambda-Id`,
      arn: targetLambda.lambda.versionedLambda.arn,
      terraformResource: targetLambda.lambda.versionedLambda,
      deadLetterArn: targetLambdaDLQ.arn,
    };

    const dataSyncEventRuleConfig: PocketEventBridgeProps = {
      eventRule: {
        name: `${config.prefix}-EventBridge-Rule`,
        pattern: {
          source: ['curation-migration-datasync'],
          'detail-type': [
            'add-scheduled-item',
            'update-scheduled-item',
            'delete-scheduled-item',
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
        functionName: targetLambda.lambda.versionedLambda.functionName,
        qualifier: targetLambda.lambda.versionedLambda.name,
        principal: 'events.amazonaws.com',
        sourceArn: dataSyncEventRule.rule.arn,
        dependsOn: [
          targetLambda.lambda.versionedLambda,
          dataSyncEventRule.rule,
        ],
      } as LambdaPermissionConfig
    );

    this.createPolicyForEventBridgeRuleToDlq(
      targetLambdaDLQ,
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
  private createLambdaTarget() {
    /**
     * Create an RDS instance if we are working in the Dev account.
     * This is only to facilitate testing
     */
    if (config.isDev) {
      this.createRds();
    }

    const { sentryDsn, gitSha } = getEnvVariableValues(this);

    const lambdaConfig: PocketVersionedLambdaProps = {
      name: `${config.prefix}-Datasync-Lambda`,
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
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
        },
        executionPolicyStatements: [
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
              `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}`,
              `arn:aws:secretsmanager:${this.vpc.region}:${this.vpc.accountId}:secret:CurationToolsDataSync/${config.environment}/*`,
            ],
          },
        ],
      },
    };
    return new PocketVersionedLambda(
      this,
      `${config.prefix}-Datasync-Lambda`,
      lambdaConfig
    );
  }

  /**
   * Todo: the policy seems correct, but the dlq is not receiving messages
   * Reference: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-dlq.html
   * @param sqsQueue
   * @param eventBridgeRuleArn
   * @private
   */
  private createPolicyForEventBridgeRuleToDlq(
    sqsQueue: sqs.SqsQueue | sqs.DataAwsSqsQueue,
    eventBridgeRuleArn: string
  ) {
    const eventBridgeRuleDlqPolicy = new iam.DataAwsIamPolicyDocument(
      this,
      `${config.prefix}-EventBridge-DLQ-Policy`,
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

    return new sqs.SqsQueuePolicy(this, 'dlq-policy', {
      queueUrl: sqsQueue.url,
      policy: eventBridgeRuleDlqPolicy,
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
