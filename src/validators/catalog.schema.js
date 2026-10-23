// Zod schemas for plans, pops, and sectors.

const { z } = require('zod');
const { pageQuerySchema } = require('./common.schema');

const createPlanSchema = z.object({
  name: z.string().min(1).max(120),
  bandwidthMbps: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const updatePlanSchema = createPlanSchema.partial();

const createPopSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  location: z.string().max(255).optional().nullable(),
});

const updatePopSchema = createPopSchema.partial();

const createSectorSchema = z.object({
  name: z.string().min(1).max(120),
  geoDescription: z.string().max(255).optional().nullable(),
});

const updateSectorSchema = createSectorSchema.partial();

module.exports = {
  createPlanSchema,
  updatePlanSchema,
  createPopSchema,
  updatePopSchema,
  createSectorSchema,
  updateSectorSchema,
  pageQuerySchema,
};
