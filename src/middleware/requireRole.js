// Allow only specific roles past this middleware.

const { AppError } = require('../utils/AppError');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401, 'Unauthorized'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission for this action', 403, 'Forbidden'));
    }

    return next();
  };
}

module.exports = { requireRole };
