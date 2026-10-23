// Load and expose environment variables used by the app.

require('dotenv').config();

const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'isp_ops',
    // Aiven and most hosted MySQL require SSL.
    ssl: String(process.env.DB_SSL || '').toLowerCase() === 'true',
    // Optional path to Aiven CA PEM from the service console.
    sslCaPath: process.env.DB_SSL_CA || '',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};

module.exports = { env };
