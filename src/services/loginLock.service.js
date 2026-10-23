// Progressive login lockout by IP + device fingerprint.

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { AppError } = require('../utils/AppError');
const { logger } = require('../utils/logger');

function lockSecondsForFailCount(failCount) {
  if (failCount >= 10) return 60 * 60;
  if (failCount >= 8) return 15 * 60;
  if (failCount >= 5) return 2 * 60;
  if (failCount >= 3) return 30;
  return 0;
}

function formatLockMessage(lockedUntil) {
  return `Too many failed login attempts. Try again after ${lockedUntil}`;
}

async function assertNotLocked(ipAddress, deviceFingerprint) {
  const rows = await query(
    `SELECT fail_count, locked_until
     FROM login_locks
     WHERE ip_address = ? AND device_fingerprint = ?
     LIMIT 1`,
    [ipAddress, deviceFingerprint],
  );

  if (!rows.length) {
    return;
  }

  const row = rows[0];
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    logger.warn(
      {
        ipAddress,
        deviceFingerprint,
        failCount: row.fail_count,
        lockedUntil: row.locked_until,
      },
      'Login blocked by progressive lockout',
    );
    throw new AppError(formatLockMessage(row.locked_until), 429, 'Too Many Requests');
  }
}

async function recordFailedLogin(ipAddress, deviceFingerprint, email) {
  const existing = await query(
    `SELECT id, fail_count FROM login_locks
     WHERE ip_address = ? AND device_fingerprint = ?
     LIMIT 1`,
    [ipAddress, deviceFingerprint],
  );

  const nextCount = existing.length ? existing[0].fail_count + 1 : 1;
  const lockSeconds = lockSecondsForFailCount(nextCount);
  const lockedUntil =
    lockSeconds > 0
      ? new Date(Date.now() + lockSeconds * 1000)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ')
      : null;

  if (existing.length) {
    await query(
      `UPDATE login_locks
       SET fail_count = ?, locked_until = ?, email = ?
       WHERE id = ?`,
      [nextCount, lockedUntil, email || null, existing[0].id],
    );
  } else {
    await query(
      `INSERT INTO login_locks (id, ip_address, device_fingerprint, email, fail_count, locked_until)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), ipAddress, deviceFingerprint, email || null, nextCount, lockedUntil],
    );
  }

  logger.warn(
    { ipAddress, deviceFingerprint, email, failCount: nextCount, lockedUntil },
    'Recorded failed login attempt',
  );

  if (lockedUntil) {
    throw new AppError(formatLockMessage(lockedUntil), 429, 'Too Many Requests');
  }
}

async function clearLoginLock(ipAddress, deviceFingerprint) {
  await query(
    `DELETE FROM login_locks
     WHERE ip_address = ? AND device_fingerprint = ?`,
    [ipAddress, deviceFingerprint],
  );
}

module.exports = {
  assertNotLocked,
  recordFailedLogin,
  clearLoginLock,
  lockSecondsForFailCount,
};
