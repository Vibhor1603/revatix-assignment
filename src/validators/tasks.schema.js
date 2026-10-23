// Zod schemas for field tasks and assignment.

const { z } = require('zod');

const taskStatusEnum = z.enum([
  'Open',
  'In-Progress',
  'Field Visit',
  'Resolved',
  'Closed',
  'Cancelled',
]);

const createTaskSchema = z.object({
  taskType: z.string().min(1).max(120),
  description: z.string().max(5000).optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial();

const taskStatusSchema = z.object({
  status: taskStatusEnum,
});

const assignTaskSchema = z.object({
  technicianId: z.string().uuid(),
  scheduledStart: z.string().min(8).max(32),
  scheduledEnd: z.string().min(8).max(32),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  taskStatusSchema,
  assignTaskSchema,
};
