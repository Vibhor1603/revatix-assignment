// IP + device fingerprint rate limits for auth entry points.

const rateLimit = require('express-rate-limit');
const { getClientIp, getDeviceFingerprint } = require('../utils/deviceFingerprint');

function authKeyGenerator(req) {
  return `${getClientIp(req)}:${getDeviceFingerprint(req)}`;
}

const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authKeyGenerator,
  validate: {
    // We intentionally key by IP + device fingerprint, not IP alone.
    keyGeneratorIpFallback: false,
  },
};

// Broad flood protection on login (separate from progressive lockout).
const loginRateLimit = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Too Many Requests',
    message: 'Login rate limit exceeded. Slow down and try again shortly.',
  },
});

const registerRateLimit = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too Many Requests',
    message: 'Too many registration attempts from this device/IP.',
  },
});

const refreshRateLimit = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too Many Requests',
    message: 'Refresh rate limit exceeded.',
  },
});

module.exports = {
  loginRateLimit,
  registerRateLimit,
  refreshRateLimit,
};
