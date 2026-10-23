// Shared Zod pieces used across resources.

const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
});

module.exports = { uuidParamSchema, pageQuerySchema };
