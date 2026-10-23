// Verify JWT and attach the current user to the request.

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { query } = require('../db/query');
const { AppError } = require('../utils/AppError');

async function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid Authorization header', 401, 'Unauthorized'));
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401, 'Unauthorized'));
  }

  const rows = await query(
    `SELECT id, name, email, role, employee_code, created_at
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [payload.sub],
  );

  if (!rows.length) {
    return next(new AppError('User not found or inactive', 401, 'Unauthorized'));
  }

  req.user = rows[0];
  return next();
}

module.exports = { auth };
