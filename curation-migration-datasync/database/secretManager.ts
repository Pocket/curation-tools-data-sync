import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { config } from '../config';

const client = new SecretsManagerClient({ region: config.aws.region });

export type DbCredentials = {
  host: string;
  username: string;
  password: string;
  port: string;
  dbname: string;
};

const dbCredentials: {
  [key: string]: DbCredentials;
} = {};
/**
 * Retrieve database credentials from Secrets store
 * @param id The ID (name) of the Secret, or the ARN string
 * @returns Promise<DbCredentials>
 */
export async function getDbCredentials(id: string): Promise<DbCredentials> {
  if (dbCredentials[id]) return dbCredentials[id];

  const data = await client.send(
    new GetSecretValueCommand({
      SecretId: id,
    }),
  );
  const parsed = JSON.parse(data.SecretString as string) as DbCredentials;
  dbCredentials[id] = parsed;
  return parsed;
}
