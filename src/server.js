// Process entry: start the HTTP server.

const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const app = require('./app');

const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, nodeEnv: env.nodeEnv },
    'API server started',
  );
});

function shutdown(signal) {
  logger.warn({ signal }, 'Shutdown signal received');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
