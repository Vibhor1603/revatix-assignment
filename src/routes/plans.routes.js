// Plans routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema, pageQuerySchema } = require('../validators/common.schema');
const {
  createPlanSchema,
  updatePlanSchema,
} = require('../validators/catalog.schema');
const plansController = require('../controllers/plans.controller');

const router = express.Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate(createPlanSchema),
  asyncHandler(plansController.create),
);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(pageQuerySchema, 'query'),
  asyncHandler(plansController.list),
);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(plansController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  validate(updatePlanSchema),
  asyncHandler(plansController.update),
);

router.delete(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  asyncHandler(plansController.remove),
);

module.exports = router;
