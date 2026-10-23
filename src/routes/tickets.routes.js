// Tickets routes (tasks under a ticket are also mounted here for create/list).

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../constants/roles');
const { uuidParamSchema, pageQuerySchema } = require('../validators/common.schema');
const {
  createTicketSchema,
  updateTicketSchema,
  ticketStatusSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
} = require('../validators/tickets.schema');
const { createTaskSchema } = require('../validators/tasks.schema');
const ticketsController = require('../controllers/tickets.controller');
const tasksController = require('../controllers/tasks.controller');

const router = express.Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(createTicketSchema),
  asyncHandler(ticketsController.create),
);

router.get(
  '/',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(listTicketsQuerySchema, 'query'),
  asyncHandler(ticketsController.list),
);

router.get(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(uuidParamSchema, 'params'),
  asyncHandler(ticketsController.getById),
);

router.patch(
  '/:id',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  validate(updateTicketSchema),
  asyncHandler(ticketsController.update),
);

router.patch(
  '/:id/status',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(uuidParamSchema, 'params'),
  validate(ticketStatusSchema),
  asyncHandler(ticketsController.updateStatus),
);

router.post(
  '/:ticketId/tasks',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT),
  validate(ticketIdParamSchema, 'params'),
  validate(createTaskSchema),
  asyncHandler(tasksController.create),
);

router.get(
  '/:ticketId/tasks',
  requireRole(ROLES.MANAGER, ROLES.SUPPORT, ROLES.TECHNICIAN),
  validate(ticketIdParamSchema, 'params'),
  validate(pageQuerySchema, 'query'),
  asyncHandler(tasksController.listForTicket),
);

module.exports = router;
