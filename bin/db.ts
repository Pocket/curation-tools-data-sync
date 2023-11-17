import knex from 'knex';

const connection = {
  host: process.env.DB_HOST || '<host>',
  user: process.env.DB_USER || '<user>',
  password: process.env.DB_PASSWORD || '<password>',
  port: 3306,
  database: 'readitla_ril-tmp',
  charset: 'utf8mb4',
};

export const dbClient = knex({
  client: 'mysql2',
  connection,
  pool: {
    /**
     * Explicitly set the session timezone. We don't want to take any chances with this
     */
    afterCreate: (connection, callback) => {
      connection.query(`SET time_zone = 'US/Central';`, (err) => {
        callback(err, connection);
      });
    },
  },
});
