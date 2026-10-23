// Network POP (Point of Presence) catalog CRUD.

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');

function mapPop(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createPop(actorUserId, data) {
  const id = randomUUID();

  try {
    await query(
      `INSERT INTO pops (id, code, name, location) VALUES (?, ?, ?, ?)`,
      [id, data.code, data.name, data.location || null],
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('POP code already exists', 409, 'Conflict');
    }
    throw error;
  }

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'pop_created',
      entityType: 'pop',
      entityId: id,
      newValue: data,
    },
  );

  return getPopById(id);
}

async function listPops(pageInput) {
  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM pops WHERE deleted_at IS NULL`,
  );
  const rows = await query(
    `SELECT * FROM pops
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [10, offset],
  );

  return listResponse(rows.map(mapPop), Number(countRows[0].total), page);
}

async function getPopById(id) {
  const rows = await query(
    `SELECT * FROM pops WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('POP not found', 404, 'Not Found');
  }

  return mapPop(rows[0]);
}

async function updatePop(actorUserId, id, data) {
  const existing = await getPopById(id);

  try {
    await query(
      `UPDATE pops SET code = ?, name = ?, location = ? WHERE id = ? AND deleted_at IS NULL`,
      [
        data.code ?? existing.code,
        data.name ?? existing.name,
        data.location !== undefined ? data.location : existing.location,
        id,
      ],
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw new AppError('POP code already exists', 409, 'Conflict');
    }
    throw error;
  }

  const updated = await getPopById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'pop_updated',
      entityType: 'pop',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function softDeletePop(actorUserId, id) {
  const existing = await getPopById(id);

  await query(
    `UPDATE pops SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'pop_deleted',
      entityType: 'pop',
      entityId: id,
      oldValue: existing,
    },
  );

  return { id, deleted: true };
}

module.exports = {
  createPop,
  listPops,
  getPopById,
  updatePop,
  softDeletePop,
};
