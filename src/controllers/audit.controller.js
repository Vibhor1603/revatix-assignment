// Audit log HTTP handlers.

const auditService = require('../services/audit.service');

async function list(req, res) {
  const result = await auditService.listAudit(req.query);
  res.status(200).json(result);
}

module.exports = { list };
