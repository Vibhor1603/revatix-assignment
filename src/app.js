// Express application setup and middleware wiring.

const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const apiRoutes = require('./routes');
const { notFound } = require('./middleware/notFound');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();

// Needed so IP-based limits work behind Render / proxies.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Structured request logs (visible in Render logs).
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/favicon.ico',
    },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} completed`;
    },
    customErrorMessage(req, res, err) {
      return `${req.method} ${req.url} failed: ${err.message}`;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          userAgent: req.headers['user-agent'],
          deviceFingerprint: req.headers['x-device-fingerprint'],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
