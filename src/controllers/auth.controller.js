// Auth HTTP handlers.

const authService = require('../services/auth.service');
const { getClientIp, getDeviceFingerprint } = require('../utils/deviceFingerprint');

function authContext(req) {
  if (req.authContext) {
    return req.authContext;
  }
  return {
    ipAddress: getClientIp(req),
    deviceFingerprint: getDeviceFingerprint(req),
  };
}

async function login(req, res) {
  const { ipAddress, deviceFingerprint } = authContext(req);
  const result = await authService.login(
    req.body.email,
    req.body.password,
    ipAddress,
    deviceFingerprint,
  );
  res.status(200).json(result);
}

async function refresh(req, res) {
  const { deviceFingerprint } = authContext(req);
  const result = await authService.refresh(req.body.refreshToken, deviceFingerprint);
  res.status(200).json(result);
}

async function logout(req, res) {
  const result = await authService.logout(req.body.refreshToken);
  res.status(200).json(result);
}

async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

async function listRegistrationRequests(req, res) {
  const result = await authService.listRegistrationRequests(req.query);
  res.status(200).json(result);
}

async function approveRegistration(req, res) {
  const result = await authService.approveRegistration(
    req.user.id,
    req.params.id,
    req.body.note,
  );
  res.status(200).json(result);
}

async function rejectRegistration(req, res) {
  const result = await authService.rejectRegistration(
    req.user.id,
    req.params.id,
    req.body.note,
  );
  res.status(200).json(result);
}

async function me(req, res) {
  res.status(200).json(authService.publicUser(req.user));
}

module.exports = {
  login,
  refresh,
  logout,
  register,
  listRegistrationRequests,
  approveRegistration,
  rejectRegistration,
  me,
};
