import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import config from './config';

const client = new SecretsManagerClient({ region: config.aws.region });

export type DbCredentials = {
  readHost: string;
  readUsername: string;
  readPassword: string;
  writeHost: string;
  writeUsername: string;
  writePassword: string;
  port?: string;
};

let dbCredentials: DbCredentials;
export async function getDbCredentials(): Promise<DbCredentials> {
  if (dbCredentials) return dbCredentials;

  const data = await client.send(
    new GetSecretValueCommand({
      SecretId: config.db.secretId,
    })
  );

  return (dbCredentials = JSON.parse(
    data.SecretString as string
  ) as DbCredentials);
}
