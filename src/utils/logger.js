// Production logger (JSON on Render; pretty in local development).

const pino = require('pino');
const { env } = require('../config/env');

const logger = pino({
  level: process.env.LOG_LEVEL || (env.nodeEnv === 'production' ? 'info' : 'debug'),
  base: {
    service: 'revatix-assignment-api',
    env: env.nodeEnv,
  },
  redact: {
    paths: [
      'password',
      'passwordHash',
      'req.headers.authorization',
      'req.body.password',
      'req.body.refreshToken',
      'refreshToken',
      'accessToken',
      'token',
    ],
    remove: true,
  },
  transport:
    env.nodeEnv === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});

module.exports = { logger };
