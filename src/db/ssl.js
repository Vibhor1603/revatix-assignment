// Build MySQL SSL options for hosted providers like Aiven.

const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');

function getSslOptions() {
  if (!env.db.ssl) {
    return undefined;
  }

  const ssl = {
    // When connecting via resolved IP, cert hostname must still match.
    servername: env.db.host,
  };

  // Optional CA file from Aiven console (recommended).
  if (env.db.sslCaPath) {
    const caPath = path.isAbsolute(env.db.sslCaPath)
      ? env.db.sslCaPath
      : path.join(process.cwd(), env.db.sslCaPath);

    ssl.ca = fs.readFileSync(caPath, 'utf8');
    ssl.rejectUnauthorized = true;
    return ssl;
  }

  // Without a CA file, Aiven's chain often fails Node's default trust store.
  // Still encrypt the connection; pin CA via DB_SSL_CA when you have it.
  ssl.rejectUnauthorized = false;
  return ssl;
}

module.exports = { getSslOptions };
