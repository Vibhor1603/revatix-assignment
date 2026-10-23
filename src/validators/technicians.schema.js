// Zod schemas for technicians and shifts.

const { z } = require('zod');

const createTechnicianSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(190),
  password: z.string().min(8).max(128),
  employeeCode: z.string().max(64).optional().nullable(),
});

const createShiftSchema = z.object({
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const technicianIdParamSchema = z.object({
  id: z.string().uuid(),
});

const shiftIdParamSchema = z.object({
  id: z.string().uuid(),
  shiftId: z.string().uuid(),
});

module.exports = {
  createTechnicianSchema,
  createShiftSchema,
  technicianIdParamSchema,
  shiftIdParamSchema,
};
