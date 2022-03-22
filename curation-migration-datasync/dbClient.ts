import knex, { Knex } from 'knex';
import config from './config';
import { getDbCredentials } from './secretManager';

let readDb: Knex;
let writeDb: Knex;

/**
 * Create a db client for reads from readitla_ril-tmp
 */
export async function readClient(): Promise<Knex> {
  if (readDb) return readDb;

  const { readHost, readUsername, readPassword, port } =
    await getDbCredentials();

  readDb = createConnection({
    host: readHost,
    user: readUsername,
    password: readPassword,
    port,
  });

  return readDb;
}

/**
 * Create a db client for writes to readitla_ril-tmp
 */
export async function writeClient(): Promise<Knex> {
  if (writeDb) return writeDb;

  const { writeHost, writeUsername, writePassword, port } =
    await getDbCredentials();

  writeDb = createConnection({
    host: writeHost,
    user: writeUsername,
    password: writePassword,
    port,
  });

  return writeDb;
}

/**
 * Create a db connection
 * @param dbConfig
 */
export function createConnection(dbConfig: {
  host: string;
  user: string;
  password: string;
  port?: string;
}): Knex {
  return knex({
    client: 'mysql',
    connection: {
      ...dbConfig,
      port: parseInt(dbConfig.port || config.db.port),
      database: config.db.dbName,
      charset: 'utf8mb4',
    },
    pool: {
      /**
       * Explicitly set the session timezone. We don't want to take any chances with this
       */
      afterCreate: (connection, callback) => {
        connection.query(`SET time_zone = '${config.db.tz}';`, (err) => {
          callback(err, connection);
        });
      },
    },
  });
}
