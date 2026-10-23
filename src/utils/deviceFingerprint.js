// Resolve a stable device fingerprint from client header or request metadata.

const crypto = require('crypto');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getDeviceFingerprint(req) {
  const headerValue = req.headers['x-device-fingerprint'];
  if (typeof headerValue === 'string' && headerValue.trim().length >= 8) {
    return headerValue.trim().slice(0, 128);
  }

  // Fallback fingerprint when the client does not send a device id.
  const raw = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['sec-ch-ua'] || '',
  ].join('|');

  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
}

module.exports = { getClientIp, getDeviceFingerprint };
