import { Construct } from 'constructs';
import { App, RemoteBackend, TerraformStack } from 'cdktf';
import { AwsProvider, DataAwsCallerIdentity, DataAwsRegion } from '@cdktf/provider-aws';
import { config } from './config';
import {
  ApplicationEventBridgeRule,
  LAMBDA_RUNTIMES,
  PocketVersionedLambda,
  PocketVersionedLambdaProps,
  PocketVPC
} from '@pocket-tools/terraform-modules';
import { lambdafunction } from '@cdktf/provider-aws';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty';
import { LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null';

class CurationToolsDataSync extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', { region: 'us-east-1' });
    new PagerdutyProvider(this, 'pagerduty_provider', { token: undefined });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: 'Pocket',
      workspaces: [{ prefix: `${config.name}-` }],
    });

    const region = new DataAwsRegion(this, 'region');
    const caller = new DataAwsCallerIdentity(this, 'caller');
    const vpc = new PocketVPC(this, 'pocket-shared-vpc');

    //todo: create target lambda to process the events
    const targetLambdaProps : PocketVersionedLambdaProps = {
      name: `${config.prefix}-lambda`,
      lambda: {
        description: `target lambda to capture add/remove curated items from curatedCorpusApi through eventBridge`,
        runtime: LAMBDA_RUNTIMES.NODEJS14,
        handler: `index.handler`,
        timeout: 150,
        environment: {
          REGION: vpc.region,
          ENVIRONMENT:
            config.environment === 'Prod' ? 'production' : 'development',
        },
        vpcConfig: {
          securityGroupIds: vpc.defaultSecurityGroups.ids,
          subnetIds: vpc.privateSubnetIds,
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
         //todo: set alarms
        },
        codeDeploy: {
          region: vpc.region,
          accountId: vpc.accountId,
        },
      },
      tags: config.tags,
    };


    const targetLambda = new PocketVersionedLambda(this,`curation-tools-datasync-lambda`,targetLambdaProps)

    //event pattern to capture curation tools add item events
    const curationToolsAddItemEventPattern : {[key: string]: any}  = {
      detail: {
        eventId: "curation-tools-add-items-event"
      }
    };


    //thoughts:
    //several event-bus associated with event rule.
    //tie a target with the event bus.
    //note: we should be able to tie multiple targets (upto 5). with one event bridge.
    //what happens when we roll out a new apply to add extra tart
    const eventBridgeRule = this.createEventBridgeRule(targetLambda,curationToolsAddItemEventPattern);
    this.createLambdaEventRuleResourcePermission(targetLambda, eventBridgeRule);
  }

  /**
   * Creates the approriate permission to allow aws events to invoke lambda
   * @param lambda
   * @param eventBridgeRule
   * @private
   */
  private createLambdaEventRuleResourcePermission(
    targetLambda: PocketVersionedLambda,
    eventBridgeRule: ApplicationEventBridgeRule
  ): void {
    new lambdafunction.LambdaPermission(this, 'lambda-permission', {
      action: 'lambda:InvokeFunction',
      functionName: targetLambda.lambda.versionedLambda.functionName,
      qualifier: targetLambda.lambda.versionedLambda.name,
      principal: 'events.amazonaws.com',
      sourceArn: eventBridgeRule.rule.arn,
      dependsOn: [targetLambda.lambda.versionedLambda, eventBridgeRule.rule],
    });
  }

  /**
   * Creates the actual rule for event bridge to trigger the lambda
   * @param lambda
   * @private
   */
  private createEventBridgeRule(
    targetLambda: PocketVersionedLambda,
    eventRule: any,
  ): ApplicationEventBridgeRule {

    return new ApplicationEventBridgeRule(this, 'event-bridge-rule', {
      name: `${config.name}-addItem-eventRule`,
      description: `captures add curated items events in eventBridge `,
      eventBusName: `${config.name}-addItemEventBus`,
      eventPattern: eventRule,
      target: {
        targetId: 'lambda',
        arn: targetLambda[0].lambda.versionedLambda.arn,
        dependsOn: targetLambda[0].lambda.versionedLambda,
      },
      tags: config.tags,
    });
  }
}

const app = new App();
new CurationToolsDataSync(app, config.domainPrefix);
// TODO: Fix the terraform version. @See https://github.com/Pocket/recommendation-api/pull/333
app.synth();
