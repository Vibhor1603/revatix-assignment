// Login and current-user helpers.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { query } = require('../db/query');
const { AppError } = require('../utils/AppError');

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    employeeCode: row.employee_code,
    createdAt: row.created_at,
  };
}

async function login(email, password) {
  const rows = await query(
    `SELECT id, name, email, role, employee_code, password_hash, created_at
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );

  if (!rows.length) {
    throw new AppError('Invalid email or password', 401, 'Unauthorized');
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    throw new AppError('Invalid email or password', 401, 'Unauthorized');
  }

  const token = jwt.sign(
    { role: user.role },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.jwtExpiresIn,
      subject: user.id,
    },
  );

  return { token, user: publicUser(user) };
}

module.exports = { login, publicUser };
