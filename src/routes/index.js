// Mount all /api/v1 route modules.

const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/plans', require('./plans.routes'));
router.use('/pops', require('./pops.routes'));
router.use('/sectors', require('./sectors.routes'));
router.use('/connections', require('./connections.routes'));
router.use('/tickets', require('./tickets.routes'));
router.use('/tasks', require('./tasks.routes'));
router.use('/technicians', require('./technicians.routes'));
router.use('/audit', require('./audit.routes'));

module.exports = router;
