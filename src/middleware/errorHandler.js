// Central error response formatter.

const { env } = require('../config/env');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const error = err.error || (statusCode >= 500 ? 'Internal Server Error' : 'Error');
  const message = err.message || 'Something went wrong';

  if (env.nodeEnv !== 'production') {
    console.error(err);
  }

  const body = { error, message };

  if (err.details) {
    body.details = err.details;
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler };
