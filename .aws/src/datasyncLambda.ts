import { Resource, TerraformResource } from 'cdktf';
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
    let targetLambda = this.createLambdaTarget();

    let targetLambdaDLQ = this.createSqsForDlq();

    let eventBridgeTarget: PocketEventBridgeTargets = {
      targetId: `${config.prefix}-datasync-target-lambda-id`,
      arn: targetLambda.lambda.versionedLambda.arn,
      terraformResource: targetLambda.lambda.versionedLambda,
      deadLetterArn: targetLambdaDLQ.arn,
    };

    const dataSyncEventRuleConfig: PocketEventBridgeProps = {
      eventRule: {
        name: `${config.prefix}-eventBridge-rule`,
        pattern: {
          source: ['curation-migration-datasync'],
          'detail-type': [
            'add-scheduled-item',
            'update-scheduled-item',
            'delete-scheduled-item',
          ],
        },
      },
      targets: [{ ...eventBridgeTarget }],
    };

    let dataSyncEventRuleWithTargetObj =
      new PocketEventBridgeRuleWithMultipleTargets(
        this,
        `${config.prefix}-eventBridge-rule`,
        dataSyncEventRuleConfig
      );

    let dataSyncEventRule = dataSyncEventRuleWithTargetObj.getEventBridge();

    new lambdafunction.LambdaPermission(
      this,
      `-datasync-lambda-Function-permission`,
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
    const targetLambda = new PocketVersionedLambda(
      this,
      `${config.prefix}-Datasync-Lambda`,
      lambdaConfig
    );

    return targetLambda;
  }

  //todo: connect this policy with lambda role.
  private createDLQExecutionPolicyOnLambda(
    executionRole: iam.IamRole,
    sqsQueue: sqs.SqsQueue | sqs.DataAwsSqsQueue
  ): iam.IamRolePolicyAttachment {
    const lambdaSqsPolicy = new iam.IamPolicy(this, 'sqs-policy', {
      name: `${config.prefix}-targetLambda-Dlq-policy`,
      policy: new iam.DataAwsIamPolicyDocument(
        this,
        `targetLambda-Dlq-policy`,
        {
          statement: [
            {
              effect: 'Allow',
              actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
                'sqs:ChangeMessageVisibility',
              ],
              resources: [sqsQueue.arn],
            },
          ],
        }
      ).json,
      dependsOn: [executionRole],
    });

    return new iam.IamRolePolicyAttachment(
      this,
      'execution-role-policy-attachment',
      {
        role: executionRole.name,
        policyArn: lambdaSqsPolicy.arn,
        dependsOn: [executionRole, lambdaSqsPolicy],
      }
    );
  }
}
