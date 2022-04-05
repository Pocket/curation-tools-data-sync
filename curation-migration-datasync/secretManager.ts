import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import config from './config';

const client = new SecretsManagerClient({ region: config.aws.region });

export type DbCredentials = {
  host: string;
  username: string;
  password: string;
  port: string;
};

let dbCredentials: DbCredentials;
/**
 * Retrieve database credentials from Secrets store
 * @param id The ID (name) of the Secret, or the ARN string
 * @returns Promise<DbCredentials>
 */
export async function getDbCredentials(id: string): Promise<DbCredentials> {
  if (dbCredentials) return dbCredentials;

  const data = await client.send(
    new GetSecretValueCommand({
      SecretId: id,
    })
  );

  return (dbCredentials = JSON.parse(
    data.SecretString as string
  ) as DbCredentials);
}
