// Zod schemas for auth endpoints.

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(190),
  password: z.string().min(8).max(128),
  role: z.enum(['manager', 'technician']),
  employeeCode: z.string().max(64).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
});

const registrationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const reviewRegistrationSchema = z.object({
  note: z.string().max(255).optional().nullable(),
});

const registrationIdParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  loginSchema,
  refreshSchema,
  logoutSchema,
  registerSchema,
  registrationListQuerySchema,
  reviewRegistrationSchema,
  registrationIdParamSchema,
};
