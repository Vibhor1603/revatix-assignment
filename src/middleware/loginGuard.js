// Progressive lock check before login attempts are processed.

const { asyncHandler } = require('../utils/asyncHandler');
const { getClientIp, getDeviceFingerprint } = require('../utils/deviceFingerprint');
const { assertNotLocked } = require('../services/loginLock.service');

const loginGuard = asyncHandler(async (req, res, next) => {
  const ipAddress = getClientIp(req);
  const deviceFingerprint = getDeviceFingerprint(req);

  req.authContext = { ipAddress, deviceFingerprint };
  await assertNotLocked(ipAddress, deviceFingerprint);
  next();
});

module.exports = { loginGuard };
