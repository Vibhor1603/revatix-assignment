// MySQL connection pool shared across the app.

const dns = require('dns').promises;
const mysql = require('mysql2/promise');
const { env } = require('../config/env');
const { getSslOptions } = require('./ssl');

let poolPromise = null;

async function resolveHost(hostname) {
  try {
    const addresses = await dns.resolve4(hostname);
    if (addresses.length > 0) {
      return addresses[0];
    }
  } catch (error) {
    // Fall back to hostname for local Docker / normal DNS.
  }
  return hostname;
}

async function buildPool() {
  const host = await resolveHost(env.db.host);

  const poolConfig = {
    host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
    timezone: '+05:30',
    dateStrings: true,
  };

  const ssl = getSslOptions();
  if (ssl) {
    poolConfig.ssl = ssl;
  }

  return mysql.createPool(poolConfig);
}

function getPool() {
  if (!poolPromise) {
    poolPromise = buildPool().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

const pool = {
  async execute(...args) {
    const p = await getPool();
    return p.execute(...args);
  },
  async query(...args) {
    const p = await getPool();
    return p.query(...args);
  },
  async getConnection() {
    const p = await getPool();
    return p.getConnection();
  },
  async end() {
    if (poolPromise) {
      const p = await poolPromise;
      poolPromise = null;
      return p.end();
    }
    return undefined;
  },
};

module.exports = { pool, getPool };
