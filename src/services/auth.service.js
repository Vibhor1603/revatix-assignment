// Auth: login, refresh tokens, registration requests, current user.

const crypto = require('crypto');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { query } = require('../db/query');
const { AppError } = require('../utils/AppError');
const { writeAudit } = require('../utils/audit');
const { getPage, getOffset, listResponse } = require('../utils/pagination');
const {
  assertNotLocked,
  recordFailedLogin,
  clearLoginLock,
} = require('./loginLock.service');
const { logger } = require('../utils/logger');

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

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(user) {
  return jwt.sign(
    { role: user.role, typ: 'access' },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.accessTokenExpiresIn,
      subject: user.id,
    },
  );
}

async function issueRefreshToken(userId, deviceFingerprint) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);
  const id = randomUUID();

  const expiresAt = new Date(Date.now() + env.refreshTokenTtlMs);
  const expiresAtSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, device_fingerprint, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, tokenHash, deviceFingerprint || null, expiresAtSql],
  );

  return rawToken;
}

async function buildAuthResponse(user, deviceFingerprint) {
  const accessToken = createAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id, deviceFingerprint);

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.accessTokenExpiresIn,
    user: publicUser(user),
  };
}

async function login(email, password, ipAddress, deviceFingerprint) {
  await assertNotLocked(ipAddress, deviceFingerprint);

  const rows = await query(
    `SELECT id, name, email, role, employee_code, password_hash, created_at
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );

  if (!rows.length) {
    logger.warn({ email, ipAddress, deviceFingerprint }, 'Login failed: user not found');
    await recordFailedLogin(ipAddress, deviceFingerprint, email);
    throw new AppError('Invalid email or password', 401, 'Unauthorized');
  }

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    logger.warn(
      { email, userId: user.id, ipAddress, deviceFingerprint },
      'Login failed: bad password',
    );
    await recordFailedLogin(ipAddress, deviceFingerprint, email);
    throw new AppError('Invalid email or password', 401, 'Unauthorized');
  }

  await clearLoginLock(ipAddress, deviceFingerprint);
  logger.info(
    { userId: user.id, email: user.email, role: user.role, ipAddress, deviceFingerprint },
    'Login succeeded',
  );
  return buildAuthResponse(user, deviceFingerprint);
}

async function refresh(refreshToken, deviceFingerprint) {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400, 'Bad Request');
  }

  const tokenHash = hashToken(refreshToken);
  const rows = await query(
    `SELECT id, user_id, expires_at, revoked_at, device_fingerprint
     FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash],
  );

  if (!rows.length) {
    logger.warn({ deviceFingerprint }, 'Refresh failed: unknown token');
    throw new AppError('Invalid refresh token', 401, 'Unauthorized');
  }

  const stored = rows[0];

  if (stored.revoked_at) {
    logger.warn({ userId: stored.user_id }, 'Refresh failed: revoked token');
    throw new AppError('Refresh token has been revoked', 401, 'Unauthorized');
  }

  if (new Date(stored.expires_at) <= new Date()) {
    logger.warn({ userId: stored.user_id }, 'Refresh failed: expired token');
    throw new AppError('Refresh token has expired', 401, 'Unauthorized');
  }

  // Soft bind: if a fingerprint was stored, it must match.
  if (
    stored.device_fingerprint &&
    deviceFingerprint &&
    stored.device_fingerprint !== deviceFingerprint
  ) {
    logger.warn(
      { userId: stored.user_id, deviceFingerprint },
      'Refresh failed: device mismatch',
    );
    throw new AppError('Refresh token device mismatch', 401, 'Unauthorized');
  }

  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`,
    [stored.id],
  );

  const users = await query(
    `SELECT id, name, email, role, employee_code, created_at
     FROM users
     WHERE id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [stored.user_id],
  );

  if (!users.length) {
    throw new AppError('User not found or inactive', 401, 'Unauthorized');
  }

  logger.info({ userId: users[0].id }, 'Refresh token rotated');
  return buildAuthResponse(users[0], deviceFingerprint || stored.device_fingerprint);
}

async function logout(refreshToken) {
  if (!refreshToken) {
    return { revoked: true };
  }

  const tokenHash = hashToken(refreshToken);
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash],
  );

  return { revoked: true };
}

async function register(data) {
  const existingUser = await query(
    `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [data.email],
  );

  if (existingUser.length) {
    throw new AppError('Email is already registered', 409, 'Conflict');
  }

  const pending = await query(
    `SELECT id FROM registration_requests
     WHERE email = ? AND status = 'pending'
     LIMIT 1`,
    [data.email],
  );

  if (pending.length) {
    throw new AppError('A registration request for this email is already pending', 409, 'Conflict');
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(data.password, 10);

  await query(
    `INSERT INTO registration_requests (
      id, name, email, password_hash, role, employee_code, phone, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      data.name,
      data.email,
      passwordHash,
      data.role,
      data.employeeCode || null,
      data.phone || null,
    ],
  );

  logger.info(
    { requestId: id, email: data.email, role: data.role },
    'Registration request submitted',
  );

  return {
    id,
    name: data.name,
    email: data.email,
    role: data.role,
    employeeCode: data.employeeCode || null,
    phone: data.phone || null,
    status: 'pending',
    message: 'Registration submitted. A manager must approve before you can log in.',
  };
}

function mapRegistration(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    employeeCode: row.employee_code,
    phone: row.phone,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listRegistrationRequests(filters) {
  const page = getPage(filters.page);
  const offset = getOffset(page);
  const where = ['1=1'];
  const params = [];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  const whereSql = where.join(' AND ');
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM registration_requests WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT id, name, email, role, employee_code, phone, status,
            reviewed_by, review_note, created_at, updated_at
     FROM registration_requests
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, 10, offset],
  );

  return listResponse(rows.map(mapRegistration), Number(countRows[0].total), page);
}

async function approveRegistration(managerId, requestId, note) {
  const rows = await query(
    `SELECT * FROM registration_requests WHERE id = ? LIMIT 1`,
    [requestId],
  );

  if (!rows.length) {
    throw new AppError('Registration request not found', 404, 'Not Found');
  }

  const request = rows[0];

  if (request.status !== 'pending') {
    throw new AppError('Only pending requests can be approved', 400, 'Bad Request');
  }

  const existingUser = await query(
    `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
    [request.email],
  );

  if (existingUser.length) {
    throw new AppError('Email is already registered', 409, 'Conflict');
  }

  const userId = randomUUID();

  await query(
    `INSERT INTO users (id, name, email, password_hash, role, employee_code)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      request.name,
      request.email,
      request.password_hash,
      request.role,
      request.employee_code,
    ],
  );

  await query(
    `UPDATE registration_requests
     SET status = 'approved', reviewed_by = ?, review_note = ?
     WHERE id = ?`,
    [managerId, note || null, requestId],
  );

  await writeAudit(
    { query },
    {
      actorUserId: managerId,
      action: 'registration_approved',
      entityType: 'registration_request',
      entityId: requestId,
      newValue: { userId, email: request.email, role: request.role },
    },
  );

  logger.info(
    { requestId, userId, email: request.email, role: request.role, managerId },
    'Registration approved',
  );

  const userRows = await query(
    `SELECT id, name, email, role, employee_code, created_at FROM users WHERE id = ?`,
    [userId],
  );

  return {
    request: mapRegistration({
      ...request,
      status: 'approved',
      reviewed_by: managerId,
      review_note: note || null,
    }),
    user: publicUser(userRows[0]),
  };
}

async function rejectRegistration(managerId, requestId, note) {
  const rows = await query(
    `SELECT * FROM registration_requests WHERE id = ? LIMIT 1`,
    [requestId],
  );

  if (!rows.length) {
    throw new AppError('Registration request not found', 404, 'Not Found');
  }

  if (rows[0].status !== 'pending') {
    throw new AppError('Only pending requests can be rejected', 400, 'Bad Request');
  }

  await query(
    `UPDATE registration_requests
     SET status = 'rejected', reviewed_by = ?, review_note = ?
     WHERE id = ?`,
    [managerId, note || null, requestId],
  );

  await writeAudit(
    { query },
    {
      actorUserId: managerId,
      action: 'registration_rejected',
      entityType: 'registration_request',
      entityId: requestId,
      newValue: { email: rows[0].email, note: note || null },
    },
  );

  logger.info(
    { requestId, email: rows[0].email, managerId },
    'Registration rejected',
  );

  return mapRegistration({
    ...rows[0],
    status: 'rejected',
    reviewed_by: managerId,
    review_note: note || null,
  });
}

module.exports = {
  publicUser,
  login,
  refresh,
  logout,
  register,
  listRegistrationRequests,
  approveRegistration,
  rejectRegistration,
};
