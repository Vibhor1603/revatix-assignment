// Read / filter append-only audit logs.

const { query } = require('../db/query');
const { getPage, getOffset, listResponse } = require('../utils/pagination');

function mapAudit(row) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    oldValue: row.old_value,
    newValue: row.new_value,
    createdAt: row.created_at,
  };
}

async function listAudit(filters) {
  const page = getPage(filters.page);
  const offset = getOffset(page);
  const where = ['1=1'];
  const params = [];

  if (filters.entityType) {
    where.push('entity_type = ?');
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    where.push('entity_id = ?');
    params.push(filters.entityId);
  }
  if (filters.action) {
    where.push('action = ?');
    params.push(filters.action);
  }
  if (filters.actorUserId) {
    where.push('actor_user_id = ?');
    params.push(filters.actorUserId);
  }

  const whereSql = where.join(' AND ');

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereSql}`,
    params,
  );

  const rows = await query(
    `SELECT * FROM audit_logs
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, 10, offset],
  );

  return listResponse(rows.map(mapAudit), Number(countRows[0].total), page);
}

module.exports = { listAudit };
