// Audit log routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { listAuditQuerySchema } = require('../validators/audit.schema');
const auditController = require('../controllers/audit.controller');

const router = express.Router();

router.use(auth);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(listAuditQuerySchema, 'query'),
  asyncHandler(auditController.list),
);

module.exports = router;
