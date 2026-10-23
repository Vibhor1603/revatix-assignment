// Standalone task routes (get/update/status/assign/unassign/cancel).

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema } = require('../validators/common.schema');
const {
  updateTaskSchema,
  taskStatusSchema,
  assignTaskSchema,
} = require('../validators/tasks.schema');
const tasksController = require('../controllers/tasks.controller');

const router = express.Router();

router.use(auth);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(uuidParamSchema, 'params'),
  asyncHandler(tasksController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  validate(updateTaskSchema),
  asyncHandler(tasksController.update),
);

router.patch(
  '/:id/status',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(uuidParamSchema, 'params'),
  validate(taskStatusSchema),
  asyncHandler(tasksController.updateStatus),
);

router.post(
  '/:id/assign',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  validate(assignTaskSchema),
  asyncHandler(tasksController.assign),
);

router.post(
  '/:id/unassign',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(tasksController.unassign),
);

router.post(
  '/:id/cancel',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(tasksController.cancel),
);

module.exports = router;
