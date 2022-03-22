import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import {
  ApplicationDynamoDBTable,
  LAMBDA_RUNTIMES,
  PocketPagerDuty,
  PocketVersionedLambda,
  PocketVersionedLambdaProps,
  PocketVPC,
} from '@pocket-tools/terraform-modules';
import { iam, lambdafunction, sqs } from '@cdktf/provider-aws';
import { getEnvVariableValues } from './utilities';
import { config } from './config';
import {
  PocketEventBridgeProps,
  PocketEventBridgeRuleWithMultipleTargets,
  PocketEventBridgeTargets,
} from '@pocket-tools/terraform-modules/dist/pocket/PocketEventBridgeRuleWithMultipleTargets';

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
      }
    );

    this.createPolicyForEventBridgeRuleToDlq(
      targetLambdaDLQ,
      dataSyncEventRuleWithTargetObj.getEventBridge().rule.arn
    );
  }

  private createSqsForDlq() {
    return new sqs.SqsQueue(this, 'datasync-target-lambda-dlq', {
      name: `${config.prefix}-Datasync-Lambda-DLQ`,
    });
  }

  private createLambdaTarget() {
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
          // CURATION_MIGRATION_TABLE: this.curationMigrationTable.dynamodb.name,
          // CURATION_MIGRATION_TABLE_HASH_KEY:
          //   this.curationMigrationTable.dynamodb.hashKey,
          REGION: this.vpc.region,
          SENTRY_DSN: sentryDsn,
          GIT_SHA: gitSha,
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
        },
      },
    };
    return new PocketVersionedLambda(
      this,
      `${config.prefix}-Datasync-Lambda`,
      lambdaConfig
    );
  }

  //todo: the policy seems correct, but the dlq is not receiving messages
  //from eventbridge
  //https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-rule-dlq.html
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
}
