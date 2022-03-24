import { ssm } from '@cdktf/provider-aws';
import { config } from './config';
import { Construct } from 'constructs';

export function getEnvVariableValues(scope: Construct) {
  const sentryDsn = new ssm.DataAwsSsmParameter(scope, 'sentry-dsn', {
    name: `/${config.name}/${config.environment}/SENTRY_DSN`,
  });

  const serviceHash = new ssm.DataAwsSsmParameter(scope, 'service-hash', {
    name: `${config.circleCIPrefix}/SERVICE_HASH`,
  });

  const parserEndpoint = new ssm.DataAwsSsmParameter(scope, 'parser-endpoint', {
    name: `/${config.name}/${config.environment}/PARSER_ENDPOINT`,
  });

  return {
    sentryDsn: sentryDsn.value,
    gitSha: serviceHash.value,
    parserEndpoint: parserEndpoint.value,
  };
}
