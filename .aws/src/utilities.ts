import { DataAwsSsmParameter } from '@cdktf/provider-aws/lib/data-aws-ssm-parameter';
import { config } from './config';
import { Construct } from 'constructs';

export function getEnvVariableValues(scope: Construct) {
  const sentryDsn = new DataAwsSsmParameter(scope, 'sentry-dsn', {
    name: `/${config.name}/${config.environment}/SENTRY_DSN`,
  });

  const serviceHash = new DataAwsSsmParameter(scope, 'service-hash', {
    name: `${config.circleCIPrefix}/SERVICE_HASH`,
  });

  const parserEndpoint = new DataAwsSsmParameter(scope, 'parser-endpoint', {
    name: `/${config.name}/${config.environment}/PARSER_ENDPOINT`,
  });

  return {
    sentryDsn: sentryDsn.value,
    gitSha: serviceHash.value,
    parserEndpoint: parserEndpoint.value,
  };
}
