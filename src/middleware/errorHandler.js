// Central error response formatter with structured logging.

const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const error = err.error || (statusCode >= 500 ? 'Internal Server Error' : 'Error');
  const message = err.message || 'Something went wrong';

  const logPayload = {
    err: {
      message: err.message,
      name: err.name,
      stack: statusCode >= 500 ? err.stack : undefined,
      statusCode,
      error,
      details: err.details,
    },
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(logPayload, 'Request failed with server error');
  } else if (statusCode >= 400) {
    logger.warn(logPayload, 'Request failed with client error');
  }

  const body = { error, message };

  if (err.details) {
    body.details = err.details;
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler };
