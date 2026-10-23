// Subscriber broadband connections.

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');
const { CONNECTION_STATUS_RANK } = require('../constants/statuses');
const { getPlanById } = require('./plans.service');
const { getPopById } = require('./pops.service');
const { getSectorById } = require('./sectors.service');
const { logger } = require('../utils/logger');

function mapConnection(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    planId: row.plan_id,
    popId: row.pop_id,
    sectorId: row.sector_id,
    planName: row.plan_name || undefined,
    popName: row.pop_name || undefined,
    popCode: row.pop_code || undefined,
    sectorName: row.sector_name || undefined,
    staticIp: row.static_ip,
    status: row.status,
    statusRank: row.status_rank,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DETAIL_SELECT = `
  SELECT c.*,
         p.name AS plan_name,
         pop.name AS pop_name,
         pop.code AS pop_code,
         s.name AS sector_name
  FROM connections c
  JOIN service_plans p ON p.id = c.plan_id
  JOIN pops pop ON pop.id = c.pop_id
  JOIN sectors s ON s.id = c.sector_id
`;

async function createConnection(actorUserId, data) {
  await getPlanById(data.planId);
  await getPopById(data.popId);
  await getSectorById(data.sectorId);

  const id = randomUUID();
  const status = data.status || 'Pending';
  const statusRank = CONNECTION_STATUS_RANK[status];

  await query(
    `INSERT INTO connections (
      id, customer_name, phone, email, address,
      plan_id, pop_id, sector_id, static_ip,
      status, status_rank, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.customerName,
      data.phone,
      data.email || null,
      data.address || null,
      data.planId,
      data.popId,
      data.sectorId,
      data.staticIp || null,
      status,
      statusRank,
      actorUserId,
    ],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'connection_created',
      entityType: 'connection',
      entityId: id,
      newValue: data,
    },
  );

  logger.info(
    {
      connectionId: id,
      planId: data.planId,
      popId: data.popId,
      sectorId: data.sectorId,
      status,
      actorUserId,
    },
    'Connection created',
  );

  return getConnectionById(id);
}

async function listConnections(filters) {
  const page = getPage(filters.page);
  const offset = getOffset(page);
  const where = ['c.deleted_at IS NULL'];
  const params = [];

  if (filters.status) {
    where.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.planId) {
    where.push('c.plan_id = ?');
    params.push(filters.planId);
  }
  if (filters.popId) {
    where.push('c.pop_id = ?');
    params.push(filters.popId);
  }
  if (filters.sectorId) {
    where.push('c.sector_id = ?');
    params.push(filters.sectorId);
  }

  const whereSql = where.join(' AND ');

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM connections c WHERE ${whereSql}`,
    params,
  );

  const rows = await query(
    `${DETAIL_SELECT}
     WHERE ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, 10, offset],
  );

  return listResponse(rows.map(mapConnection), Number(countRows[0].total), page);
}

async function getConnectionById(id) {
  const rows = await query(
    `${DETAIL_SELECT}
     WHERE c.id = ? AND c.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Connection not found', 404, 'Not Found');
  }

  return mapConnection(rows[0]);
}

async function updateConnection(actorUserId, id, data) {
  const existing = await getConnectionById(id);

  if (data.planId) {
    await getPlanById(data.planId);
  }
  if (data.popId) {
    await getPopById(data.popId);
  }
  if (data.sectorId) {
    await getSectorById(data.sectorId);
  }

  await query(
    `UPDATE connections SET
       customer_name = ?,
       phone = ?,
       email = ?,
       address = ?,
       plan_id = ?,
       pop_id = ?,
       sector_id = ?,
       static_ip = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      data.customerName ?? existing.customerName,
      data.phone ?? existing.phone,
      data.email !== undefined ? data.email : existing.email,
      data.address !== undefined ? data.address : existing.address,
      data.planId ?? existing.planId,
      data.popId ?? existing.popId,
      data.sectorId ?? existing.sectorId,
      data.staticIp !== undefined ? data.staticIp : existing.staticIp,
      id,
    ],
  );

  const updated = await getConnectionById(id);

  const action =
    data.planId && data.planId !== existing.planId
      ? 'plan_change'
      : 'connection_updated';

  await writeAudit(
    { query },
    {
      actorUserId,
      action,
      entityType: 'connection',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function updateConnectionStatus(actorUserId, id, status) {
  const existing = await getConnectionById(id);
  const statusRank = CONNECTION_STATUS_RANK[status];

  await query(
    `UPDATE connections SET status = ?, status_rank = ? WHERE id = ? AND deleted_at IS NULL`,
    [status, statusRank, id],
  );

  const updated = await getConnectionById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'status_change',
      entityType: 'connection',
      entityId: id,
      oldValue: { status: existing.status, statusRank: existing.statusRank },
      newValue: { status: updated.status, statusRank: updated.statusRank },
    },
  );

  logger.info(
    {
      connectionId: id,
      from: existing.status,
      to: status,
      actorUserId,
    },
    'Connection status updated',
  );

  return updated;
}

async function softDeleteConnection(actorUserId, id) {
  const existing = await getConnectionById(id);

  await query(
    `UPDATE connections SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'connection_deleted',
      entityType: 'connection',
      entityId: id,
      oldValue: existing,
    },
  );

  logger.info({ connectionId: id, actorUserId }, 'Connection soft-deleted');

  return { id, deleted: true };
}

module.exports = {
  createConnection,
  listConnections,
  getConnectionById,
  updateConnection,
  updateConnectionStatus,
  softDeleteConnection,
};
