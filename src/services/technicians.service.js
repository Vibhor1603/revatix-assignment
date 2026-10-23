// Technicians are users with role=technician, plus their shifts.

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');
const { ROLES } = require('../constants/roles');

function mapTechnician(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    employeeCode: row.employee_code,
    createdAt: row.created_at,
  };
}

function mapShift(row) {
  return {
    id: row.id,
    technicianId: row.technician_id,
    shiftDate: row.shift_date,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
  };
}

async function listTechnicians(pageInput) {
  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM users
     WHERE role = 'technician' AND deleted_at IS NULL`,
  );

  const rows = await query(
    `SELECT id, name, email, role, employee_code, created_at
     FROM users
     WHERE role = 'technician' AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [10, offset],
  );

  return listResponse(rows.map(mapTechnician), Number(countRows[0].total), page);
}

async function createTechnician(actorUserId, data) {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(data.password, 10);

  try {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, employee_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.email,
        passwordHash,
        ROLES.TECHNICIAN,
        data.employeeCode || null,
      ],
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('Email already exists', 409, 'Conflict');
    }
    throw error;
  }

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'technician_created',
      entityType: 'user',
      entityId: id,
      newValue: { name: data.name, email: data.email, role: ROLES.TECHNICIAN },
    },
  );

  const rows = await query(
    `SELECT id, name, email, role, employee_code, created_at FROM users WHERE id = ?`,
    [id],
  );

  return mapTechnician(rows[0]);
}

async function assertTechnician(id) {
  const rows = await query(
    `SELECT id FROM users
     WHERE id = ? AND role = 'technician' AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Technician not found', 404, 'Not Found');
  }
}

async function createShift(actorUserId, technicianId, data) {
  await assertTechnician(technicianId);

  if (data.endTime <= data.startTime) {
    throw new AppError(
      'Shift endTime must be after startTime on the same day (no overnight shifts)',
      400,
      'Bad Request',
    );
  }

  // Reject overlapping shifts for the same technician and date.
  const overlaps = await query(
    `SELECT id FROM shifts
     WHERE technician_id = ?
       AND shift_date = ?
       AND deleted_at IS NULL
       AND start_time < ?
       AND end_time > ?
     LIMIT 1`,
    [technicianId, data.shiftDate, data.endTime, data.startTime],
  );

  if (overlaps.length) {
    throw new AppError('Shift overlaps an existing shift for this technician', 400, 'Bad Request');
  }

  const id = randomUUID();

  await query(
    `INSERT INTO shifts (id, technician_id, shift_date, start_time, end_time)
     VALUES (?, ?, ?, ?, ?)`,
    [id, technicianId, data.shiftDate, data.startTime, data.endTime],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'shift_created',
      entityType: 'shift',
      entityId: id,
      newValue: { technicianId, ...data },
    },
  );

  const rows = await query(`SELECT * FROM shifts WHERE id = ?`, [id]);
  return mapShift(rows[0]);
}

async function listShifts(requester, technicianId, pageInput) {
  await assertTechnician(technicianId);

  if (
    requester.role === ROLES.TECHNICIAN &&
    requester.id !== technicianId
  ) {
    throw new AppError('Technicians can only view their own shifts', 403, 'Forbidden');
  }

  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM shifts
     WHERE technician_id = ? AND deleted_at IS NULL`,
    [technicianId],
  );

  const rows = await query(
    `SELECT * FROM shifts
     WHERE technician_id = ? AND deleted_at IS NULL
     ORDER BY shift_date DESC, start_time ASC
     LIMIT ? OFFSET ?`,
    [technicianId, 10, offset],
  );

  return listResponse(rows.map(mapShift), Number(countRows[0].total), page);
}

async function softDeleteShift(actorUserId, technicianId, shiftId) {
  await assertTechnician(technicianId);

  const rows = await query(
    `SELECT * FROM shifts
     WHERE id = ? AND technician_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [shiftId, technicianId],
  );

  if (!rows.length) {
    throw new AppError('Shift not found', 404, 'Not Found');
  }

  await query(
    `UPDATE shifts SET deleted_at = NOW() WHERE id = ?`,
    [shiftId],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'shift_deleted',
      entityType: 'shift',
      entityId: shiftId,
      oldValue: mapShift(rows[0]),
    },
  );

  return { id: shiftId, deleted: true };
}

module.exports = {
  listTechnicians,
  createTechnician,
  createShift,
  listShifts,
  softDeleteShift,
};
