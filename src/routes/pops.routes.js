// POPs routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema, pageQuerySchema } = require('../validators/common.schema');
const { createPopSchema, updatePopSchema } = require('../validators/catalog.schema');
const popsController = require('../controllers/pops.controller');

const router = express.Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate(createPopSchema),
  asyncHandler(popsController.create),
);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(pageQuerySchema, 'query'),
  asyncHandler(popsController.list),
);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(popsController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  validate(updatePopSchema),
  asyncHandler(popsController.update),
);

router.delete(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  asyncHandler(popsController.remove),
);

module.exports = router;
