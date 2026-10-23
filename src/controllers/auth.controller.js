// Auth HTTP handlers.

const authService = require('../services/auth.service');

async function login(req, res) {
  const result = await authService.login(req.body.email, req.body.password);
  res.status(200).json(result);
}

async function me(req, res) {
  res.status(200).json(authService.publicUser(req.user));
}

module.exports = { login, me };
