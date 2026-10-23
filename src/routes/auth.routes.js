// Auth routes: login, refresh, register + manager approval.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { loginGuard } = require('../middleware/loginGuard');
const {
  loginRateLimit,
  registerRateLimit,
  refreshRateLimit,
} = require('../middleware/rateLimits');
const { ROLES } = require('../constants/roles');
const {
  loginSchema,
  refreshSchema,
  logoutSchema,
  registerSchema,
  registrationListQuerySchema,
  reviewRegistrationSchema,
  registrationIdParamSchema,
} = require('../validators/auth.schema');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/login',
  loginRateLimit,
  loginGuard,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  '/refresh',
  refreshRateLimit,
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

router.post(
  '/logout',
  validate(logoutSchema),
  asyncHandler(authController.logout),
);

router.post(
  '/register',
  registerRateLimit,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.get('/me', auth, asyncHandler(authController.me));

router.get(
  '/registration-requests',
  auth,
  requireRole(ROLES.MANAGER),
  validate(registrationListQuerySchema, 'query'),
  asyncHandler(authController.listRegistrationRequests),
);

router.post(
  '/registration-requests/:id/approve',
  auth,
  requireRole(ROLES.MANAGER),
  validate(registrationIdParamSchema, 'params'),
  validate(reviewRegistrationSchema),
  asyncHandler(authController.approveRegistration),
);

router.post(
  '/registration-requests/:id/reject',
  auth,
  requireRole(ROLES.MANAGER),
  validate(registrationIdParamSchema, 'params'),
  validate(reviewRegistrationSchema),
  asyncHandler(authController.rejectRegistration),
);

module.exports = router;
