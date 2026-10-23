// Apply sql/schema.sql using the app DB config (supports Aiven SSL).

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const mysql = require('mysql2/promise');
const { env } = require('../src/config/env');
const { getSslOptions } = require('../src/db/ssl');

async function resolveHost(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses.length > 0) {
      return addresses[0];
    }
  } catch (error) {
    // Fall back to hostname.
  }
  return hostname;
}

async function main() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const host = await resolveHost(env.db.host);

  const config = {
    host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: true,
  };

  const ssl = getSslOptions();
  if (ssl) {
    config.ssl = ssl;
  }

  const connection = await mysql.createConnection(config);

  try {
    await connection.query(sql);
    console.log(`Schema applied to ${env.db.host}/${env.db.database}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
