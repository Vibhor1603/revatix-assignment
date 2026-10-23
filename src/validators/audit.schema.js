// Zod schema for audit list filters.

const { z } = require('zod');

const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  entityType: z.string().max(64).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  actorUserId: z.string().uuid().optional(),
});

module.exports = { listAuditQuerySchema };
