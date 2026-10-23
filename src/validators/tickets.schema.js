// Zod schemas for tickets.

const { z } = require('zod');

const ticketStatusEnum = z.enum([
  'Open',
  'In-Progress',
  'Field Visit',
  'Resolved',
  'Closed',
]);

const createTicketSchema = z.object({
  connectionId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  complaintType: z.string().min(1).max(64).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  slaDueAt: z.string().min(8).max(32),
});

const updateTicketSchema = createTicketSchema.omit({ connectionId: true }).partial();

const ticketStatusSchema = z.object({
  status: ticketStatusEnum,
});

const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: ticketStatusEnum.optional(),
  connectionId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

const ticketIdParamSchema = z.object({
  ticketId: z.string().uuid(),
});

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  ticketStatusSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
};
