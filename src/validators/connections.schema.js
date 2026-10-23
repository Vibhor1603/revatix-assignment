// Zod schemas for connections.

const { z } = require('zod');

const connectionStatusEnum = z.enum(['Pending', 'Active', 'Suspended', 'Terminated']);

const createConnectionSchema = z.object({
  customerName: z.string().min(1).max(120),
  phone: z.string().min(3).max(40),
  email: z.string().email().max(190).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  planId: z.string().uuid(),
  popId: z.string().uuid(),
  sectorId: z.string().uuid(),
  staticIp: z.string().max(64).optional().nullable(),
  status: connectionStatusEnum.optional(),
});

const updateConnectionSchema = createConnectionSchema.partial();

const connectionStatusSchema = z.object({
  status: connectionStatusEnum,
});

const listConnectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: connectionStatusEnum.optional(),
  planId: z.string().uuid().optional(),
  popId: z.string().uuid().optional(),
  sectorId: z.string().uuid().optional(),
});

module.exports = {
  createConnectionSchema,
  updateConnectionSchema,
  connectionStatusSchema,
  listConnectionsQuerySchema,
};
