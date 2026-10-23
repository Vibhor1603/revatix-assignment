// Zod schemas for auth endpoints.

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(8).max(128),
});

module.exports = { loginSchema };
