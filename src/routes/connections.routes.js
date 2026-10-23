// Connections routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema } = require('../validators/common.schema');
const {
  createConnectionSchema,
  updateConnectionSchema,
  connectionStatusSchema,
  listConnectionsQuerySchema,
} = require('../validators/connections.schema');
const connectionsController = require('../controllers/connections.controller');

const router = express.Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate(createConnectionSchema),
  asyncHandler(connectionsController.create),
);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(listConnectionsQuerySchema, 'query'),
  asyncHandler(connectionsController.list),
);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(connectionsController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  validate(updateConnectionSchema),
  asyncHandler(connectionsController.update),
);

router.patch(
  '/:id/status',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  validate(connectionStatusSchema),
  asyncHandler(connectionsController.updateStatus),
);

router.delete(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  asyncHandler(connectionsController.remove),
);

module.exports = router;
