// Technicians and shifts routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { pageQuerySchema } = require('../validators/common.schema');
const {
  createTechnicianSchema,
  createShiftSchema,
  technicianIdParamSchema,
  shiftIdParamSchema,
} = require('../validators/technicians.schema');
const techniciansController = require('../controllers/technicians.controller');

const router = express.Router();

router.use(auth);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(pageQuerySchema, 'query'),
  asyncHandler(techniciansController.list),
);

router.post(
  '/',
  requireRole(ROLES.MANAGER),
  validate(createTechnicianSchema),
  asyncHandler(techniciansController.create),
);

router.post(
  '/:id/shifts',
  requireRole(ROLES.MANAGER),
  validate(technicianIdParamSchema, 'params'),
  validate(createShiftSchema),
  asyncHandler(techniciansController.createShift),
);

router.get(
  '/:id/shifts',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(technicianIdParamSchema, 'params'),
  validate(pageQuerySchema, 'query'),
  asyncHandler(techniciansController.listShifts),
);

router.delete(
  '/:id/shifts/:shiftId',
  requireRole(ROLES.MANAGER),
  validate(shiftIdParamSchema, 'params'),
  asyncHandler(techniciansController.removeShift),
);

module.exports = router;
