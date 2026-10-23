// Auth routes.

const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { auth } = require('../middleware/auth');
const { loginSchema } = require('../validators/auth.schema');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', auth, asyncHandler(authController.me));

module.exports = router;
