// Master service tickets (complaints).

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');
const { TICKET_STATUS_RANK, OPEN_TASK_STATUSES } = require('../constants/statuses');
const { getConnectionById } = require('./connections.service');
const { logger } = require('../utils/logger');

function mapTicket(row) {
  return {
    id: row.id,
    connectionId: row.connection_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    complaintType: row.complaint_type,
    priority: row.priority,
    slaDueAt: row.sla_due_at,
    status: row.status,
    statusRank: row.status_rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createTicket(actorUserId, data) {
  const connection = await getConnectionById(data.connectionId);

  if (connection.status === 'Terminated') {
    logger.warn(
      { connectionId: data.connectionId, actorUserId },
      'Ticket create rejected: connection terminated',
    );
    throw new AppError(
      'Cannot create a ticket for a Terminated connection',
      400,
      'Bad Request',
    );
  }

  const id = randomUUID();
  const status = 'Open';
  const statusRank = TICKET_STATUS_RANK[status];

  await query(
    `INSERT INTO tickets (
      id, connection_id, created_by, title, description,
      complaint_type, priority, sla_due_at, status, status_rank
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.connectionId,
      actorUserId,
      data.title,
      data.description || null,
      data.complaintType || 'other',
      data.priority || 'medium',
      data.slaDueAt,
      status,
      statusRank,
    ],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'ticket_created',
      entityType: 'ticket',
      entityId: id,
      newValue: data,
    },
  );

  logger.info(
    {
      ticketId: id,
      connectionId: data.connectionId,
      priority: data.priority || 'medium',
      actorUserId,
    },
    'Ticket created',
  );

  return getTicketById(id);
}

async function listTickets(filters) {
  const page = getPage(filters.page);
  const offset = getOffset(page);
  const where = ['deleted_at IS NULL'];
  const params = [];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.connectionId) {
    where.push('connection_id = ?');
    params.push(filters.connectionId);
  }
  if (filters.priority) {
    where.push('priority = ?');
    params.push(filters.priority);
  }

  const whereSql = where.join(' AND ');
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM tickets WHERE ${whereSql}`,
    params,
  );
  const rows = await query(
    `SELECT * FROM tickets
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, 10, offset],
  );

  return listResponse(rows.map(mapTicket), Number(countRows[0].total), page);
}

async function getTicketById(id) {
  const rows = await query(
    `SELECT * FROM tickets WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Ticket not found', 404, 'Not Found');
  }

  return mapTicket(rows[0]);
}

async function updateTicket(actorUserId, id, data) {
  const existing = await getTicketById(id);

  await query(
    `UPDATE tickets SET
       title = ?,
       description = ?,
       complaint_type = ?,
       priority = ?,
       sla_due_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      data.title ?? existing.title,
      data.description !== undefined ? data.description : existing.description,
      data.complaintType ?? existing.complaintType,
      data.priority ?? existing.priority,
      data.slaDueAt ?? existing.slaDueAt,
      id,
    ],
  );

  const updated = await getTicketById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'ticket_updated',
      entityType: 'ticket',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function updateTicketStatus(actorUserId, id, status) {
  const existing = await getTicketById(id);

  if (status === 'Closed') {
    const placeholders = OPEN_TASK_STATUSES.map(() => '?').join(', ');
    const openTasks = await query(
      `SELECT id FROM field_tasks
       WHERE ticket_id = ?
         AND deleted_at IS NULL
         AND status IN (${placeholders})
       LIMIT 1`,
      [id, ...OPEN_TASK_STATUSES],
    );

    if (openTasks.length) {
      logger.warn(
        { ticketId: id, openTaskId: openTasks[0].id, actorUserId },
        'Ticket close rejected: open tasks remain',
      );
      throw new AppError(
        'Cannot close ticket while tasks are still open (not Closed or Cancelled)',
        400,
        'Bad Request',
      );
    }
  }

  const statusRank = TICKET_STATUS_RANK[status];

  await query(
    `UPDATE tickets SET status = ?, status_rank = ? WHERE id = ? AND deleted_at IS NULL`,
    [status, statusRank, id],
  );

  const updated = await getTicketById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'status_change',
      entityType: 'ticket',
      entityId: id,
      oldValue: { status: existing.status, statusRank: existing.statusRank },
      newValue: { status: updated.status, statusRank: updated.statusRank },
    },
  );

  logger.info(
    {
      ticketId: id,
      from: existing.status,
      to: status,
      actorUserId,
    },
    'Ticket status updated',
  );

  return updated;
}

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
};
