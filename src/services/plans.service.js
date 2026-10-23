// Service plans catalog CRUD.

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    bandwidthMbps: row.bandwidth_mbps,
    price: Number(row.price),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createPlan(actorUserId, data) {
  const id = randomUUID();

  await query(
    `INSERT INTO service_plans (id, name, bandwidth_mbps, price)
     VALUES (?, ?, ?, ?)`,
    [id, data.name, data.bandwidthMbps, data.price],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'plan_created',
      entityType: 'service_plan',
      entityId: id,
      newValue: data,
    },
  );

  return getPlanById(id);
}

async function listPlans(pageInput) {
  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM service_plans WHERE deleted_at IS NULL`,
  );
  const rows = await query(
    `SELECT * FROM service_plans
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [10, offset],
  );

  return listResponse(rows.map(mapPlan), Number(countRows[0].total), page);
}

async function getPlanById(id) {
  const rows = await query(
    `SELECT * FROM service_plans WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Plan not found', 404, 'Not Found');
  }

  return mapPlan(rows[0]);
}

async function updatePlan(actorUserId, id, data) {
  const existing = await getPlanById(id);

  await query(
    `UPDATE service_plans
     SET name = ?, bandwidth_mbps = ?, price = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      data.name ?? existing.name,
      data.bandwidthMbps ?? existing.bandwidthMbps,
      data.price ?? existing.price,
      id,
    ],
  );

  const updated = await getPlanById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'plan_updated',
      entityType: 'service_plan',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function softDeletePlan(actorUserId, id) {
  const existing = await getPlanById(id);

  await query(
    `UPDATE service_plans SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'plan_deleted',
      entityType: 'service_plan',
      entityId: id,
      oldValue: existing,
    },
  );

  return { id, deleted: true };
}

module.exports = {
  createPlan,
  listPlans,
  getPlanById,
  updatePlan,
  softDeletePlan,
};
