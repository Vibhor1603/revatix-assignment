// Application error with HTTP status for the error middleware.

class AppError extends Error {
  constructor(message, statusCode = 400, error = 'Bad Request', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    if (details) {
      this.details = details;
    }
  }
}

module.exports = { AppError };
