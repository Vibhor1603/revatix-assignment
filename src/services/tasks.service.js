// Field tasks under tickets, including assign conflict checks.

const { randomUUID } = require('crypto');
const { query, withTransaction } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');
const { TASK_STATUS_RANK } = require('../constants/statuses');
const { ROLES } = require('../constants/roles');
const { getTicketById } = require('./tickets.service');

function mapTask(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    taskType: row.task_type,
    description: row.description,
    technicianId: row.technician_id,
    technicianName: row.technician_name || undefined,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    status: row.status,
    statusRank: row.status_rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertSameDayWindow(start, end) {
  const startDate = String(start).slice(0, 10);
  const endDate = String(end).slice(0, 10);

  if (startDate !== endDate) {
    throw new AppError(
      'Assignment window cannot span midnight; use the same calendar day',
      400,
      'Bad Request',
    );
  }

  if (new Date(end) <= new Date(start)) {
    throw new AppError('scheduledEnd must be after scheduledStart', 400, 'Bad Request');
  }
}

function toTimePart(dateTime) {
  // "YYYY-MM-DD HH:MM:SS" or ISO → "HH:MM:SS"
  const normalized = String(dateTime).replace('T', ' ');
  return normalized.slice(11, 19);
}

async function createTask(actorUserId, ticketId, data) {
  await getTicketById(ticketId);

  const id = randomUUID();
  const status = 'Open';

  await query(
    `INSERT INTO field_tasks (
      id, ticket_id, task_type, description, status, status_rank
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, ticketId, data.taskType, data.description || null, status, TASK_STATUS_RANK[status]],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'task_created',
      entityType: 'field_task',
      entityId: id,
      newValue: { ticketId, ...data },
    },
  );

  return getTaskById(id);
}

async function listTasksForTicket(ticketId, pageInput) {
  await getTicketById(ticketId);

  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM field_tasks
     WHERE ticket_id = ? AND deleted_at IS NULL`,
    [ticketId],
  );

  const rows = await query(
    `SELECT t.*, u.name AS technician_name
     FROM field_tasks t
     LEFT JOIN users u ON u.id = t.technician_id
     WHERE t.ticket_id = ? AND t.deleted_at IS NULL
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [ticketId, 10, offset],
  );

  return listResponse(rows.map(mapTask), Number(countRows[0].total), page);
}

async function getTaskById(id) {
  const rows = await query(
    `SELECT t.*, u.name AS technician_name
     FROM field_tasks t
     LEFT JOIN users u ON u.id = t.technician_id
     WHERE t.id = ? AND t.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Task not found', 404, 'Not Found');
  }

  return mapTask(rows[0]);
}

async function updateTask(actorUserId, id, data) {
  const existing = await getTaskById(id);

  await query(
    `UPDATE field_tasks SET task_type = ?, description = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [
      data.taskType ?? existing.taskType,
      data.description !== undefined ? data.description : existing.description,
      id,
    ],
  );

  const updated = await getTaskById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'task_updated',
      entityType: 'field_task',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function updateTaskStatus(actorUser, id, status) {
  const existing = await getTaskById(id);

  if (actorUser.role === ROLES.TECHNICIAN && existing.technicianId !== actorUser.id) {
    throw new AppError('Technicians can only update their assigned tasks', 403, 'Forbidden');
  }

  const statusRank = TASK_STATUS_RANK[status];

  await query(
    `UPDATE field_tasks SET status = ?, status_rank = ? WHERE id = ? AND deleted_at IS NULL`,
    [status, statusRank, id],
  );

  const updated = await getTaskById(id);

  await writeAudit(
    { query },
    {
      actorUserId: actorUser.id,
      action: 'status_change',
      entityType: 'field_task',
      entityId: id,
      oldValue: { status: existing.status, statusRank: existing.statusRank },
      newValue: { status: updated.status, statusRank: updated.statusRank },
    },
  );

  return updated;
}

async function assignTask(actorUserId, id, data) {
  assertSameDayWindow(data.scheduledStart, data.scheduledEnd);

  return withTransaction(async (tx) => {
    const taskRows = await tx.query(
      `SELECT * FROM field_tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      [id],
    );

    if (!taskRows.length) {
      throw new AppError('Task not found', 404, 'Not Found');
    }

    const task = taskRows[0];

    if (task.status === 'Cancelled' || task.status === 'Closed') {
      throw new AppError('Cannot assign a Closed or Cancelled task', 400, 'Bad Request');
    }

    const techRows = await tx.query(
      `SELECT id, name, role FROM users
       WHERE id = ? AND role = 'technician' AND deleted_at IS NULL
       LIMIT 1`,
      [data.technicianId],
    );

    if (!techRows.length) {
      throw new AppError('Technician not found', 404, 'Not Found');
    }

    const shiftDate = String(data.scheduledStart).slice(0, 10);
    const startTime = toTimePart(data.scheduledStart);
    const endTime = toTimePart(data.scheduledEnd);

    const shifts = await tx.query(
      `SELECT id FROM shifts
       WHERE technician_id = ?
         AND shift_date = ?
         AND deleted_at IS NULL
         AND start_time <= ?
         AND end_time >= ?
       LIMIT 1`,
      [data.technicianId, shiftDate, startTime, endTime],
    );

    if (!shifts.length) {
      throw new AppError(
        'Assignment is outside the technician shift window',
        400,
        'Bad Request',
      );
    }

    // Overlap: existing.start < new.end AND existing.end > new.start
    const overlaps = await tx.query(
      `SELECT id, scheduled_start, scheduled_end FROM field_tasks
       WHERE technician_id = ?
         AND id <> ?
         AND deleted_at IS NULL
         AND status NOT IN ('Closed', 'Cancelled')
         AND scheduled_start IS NOT NULL
         AND scheduled_end IS NOT NULL
         AND scheduled_start < ?
         AND scheduled_end > ?
       LIMIT 1`,
      [data.technicianId, id, data.scheduledEnd, data.scheduledStart],
    );

    if (overlaps.length) {
      throw new AppError(
        `Technician has overlapping dispatch from ${overlaps[0].scheduled_start} to ${overlaps[0].scheduled_end}`,
        400,
        'Bad Request',
      );
    }

    const previousTech = task.technician_id;

    await tx.query(
      `UPDATE field_tasks
       SET technician_id = ?, scheduled_start = ?, scheduled_end = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [data.technicianId, data.scheduledStart, data.scheduledEnd, id],
    );

    const action =
      previousTech && previousTech !== data.technicianId
        ? 'task_reassigned'
        : 'task_assigned';

    await writeAudit(tx, {
      actorUserId,
      action,
      entityType: 'field_task',
      entityId: id,
      oldValue: {
        technicianId: previousTech,
        scheduledStart: task.scheduled_start,
        scheduledEnd: task.scheduled_end,
      },
      newValue: {
        technicianId: data.technicianId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
      },
    });

    const updatedRows = await tx.query(
      `SELECT t.*, u.name AS technician_name
       FROM field_tasks t
       LEFT JOIN users u ON u.id = t.technician_id
       WHERE t.id = ?
       LIMIT 1`,
      [id],
    );

    return mapTask(updatedRows[0]);
  });
}

async function unassignTask(actorUserId, id) {
  const existing = await getTaskById(id);

  await query(
    `UPDATE field_tasks
     SET technician_id = NULL, scheduled_start = NULL, scheduled_end = NULL
     WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  const updated = await getTaskById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'task_unassigned',
      entityType: 'field_task',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function cancelTask(actorUserId, id) {
  const existing = await getTaskById(id);
  const status = 'Cancelled';

  await query(
    `UPDATE field_tasks SET status = ?, status_rank = ? WHERE id = ? AND deleted_at IS NULL`,
    [status, TASK_STATUS_RANK[status], id],
  );

  const updated = await getTaskById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'task_cancelled',
      entityType: 'field_task',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    },
  );

  return updated;
}

module.exports = {
  createTask,
  listTasksForTicket,
  getTaskById,
  updateTask,
  updateTaskStatus,
  assignTask,
  unassignTask,
  cancelTask,
};
