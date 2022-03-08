import { SSM } from '@cdktf/provider-aws';
import { config } from './config';
import { Construct } from 'constructs';

export function getEnvVariableValues(scope: Construct) {
  const sentryDsn = new SSM.DataAwsSsmParameter(scope, 'sentry-dsn', {
    name: `/${config.name}/${config.environment}/SENTRY_DSN`,
  });

  const serviceHash = new SSM.DataAwsSsmParameter(scope, 'service-hash', {
    name: `${config.circleCIPrefix}/SERVICE_HASH`,
  });

  return { sentryDsn: sentryDsn.value, gitSha: serviceHash.value };
}
