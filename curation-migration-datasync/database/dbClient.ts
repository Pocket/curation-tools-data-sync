import knex, { Knex } from 'knex';
import { config } from '../config';
import { getDbCredentials } from './secretManager';

let readDb: Knex;
let writeDb: Knex;

/**
 * Create a db client for reads from readitla_ril-tmp
 */
export async function readClient(): Promise<Knex> {
  if (readDb) return readDb;

  const { host, username, password, port, dbname } = await getDbCredentials(
    config.db.readSecretId,
  );

  readDb = createConnection({
    host,
    user: username,
    password,
    dbname,
    port,
  });

  return readDb;
}

/**
 * Create a db client for writes to readitla_ril-tmp
 */
export async function writeClient(): Promise<Knex> {
  if (writeDb) return writeDb;

  const { host, username, password, port, dbname } = await getDbCredentials(
    config.db.writeSecretId,
  );

  writeDb = createConnection({
    host,
    user: username,
    password,
    dbname,
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
  dbname: string;
  port?: string;
}): Knex {
  const connection = {
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.dbname || config.db.dbname,
    port: parseInt(dbConfig.port || config.db.port),
    charset: config.db.charset,
  };
  return knex({
    client: 'mysql2',
    connection,
    pool: {
      min: 0, //knex docs state to set to 0 so that idle connections are released. Default was 2 for legacy knex reasons (according to docs)
      max: 10, //knex default
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
