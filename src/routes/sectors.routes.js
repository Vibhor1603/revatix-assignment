// Sectors routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema, pageQuerySchema } = require('../validators/common.schema');
const {
  createSectorSchema,
  updateSectorSchema,
} = require('../validators/catalog.schema');
const sectorsController = require('../controllers/sectors.controller');

const router = express.Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate(createSectorSchema),
  asyncHandler(sectorsController.create),
);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(pageQuerySchema, 'query'),
  asyncHandler(sectorsController.list),
);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  asyncHandler(sectorsController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  validate(updateSectorSchema),
  asyncHandler(sectorsController.update),
);

router.delete(
  '/:id',
  requireRole(ROLES.MANAGER),
  validate(uuidParamSchema, 'params'),
  asyncHandler(sectorsController.remove),
);

module.exports = router;
