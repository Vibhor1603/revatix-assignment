// Geographic sectors catalog CRUD (independent of POP).

const { randomUUID } = require('crypto');
const { query } = require('../db/query');
const { writeAudit } = require('../utils/audit');
const { AppError } = require('../utils/AppError');
const { getPage, getOffset, listResponse } = require('../utils/pagination');

function mapSector(row) {
  return {
    id: row.id,
    name: row.name,
    geoDescription: row.geo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createSector(actorUserId, data) {
  const id = randomUUID();

  await query(
    `INSERT INTO sectors (id, name, geo_description) VALUES (?, ?, ?)`,
    [id, data.name, data.geoDescription || null],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'sector_created',
      entityType: 'sector',
      entityId: id,
      newValue: data,
    },
  );

  return getSectorById(id);
}

async function listSectors(pageInput) {
  const page = getPage(pageInput);
  const offset = getOffset(page);

  const countRows = await query(
    `SELECT COUNT(*) AS total FROM sectors WHERE deleted_at IS NULL`,
  );
  const rows = await query(
    `SELECT * FROM sectors
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [10, offset],
  );

  return listResponse(rows.map(mapSector), Number(countRows[0].total), page);
}

async function getSectorById(id) {
  const rows = await query(
    `SELECT * FROM sectors WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );

  if (!rows.length) {
    throw new AppError('Sector not found', 404, 'Not Found');
  }

  return mapSector(rows[0]);
}

async function updateSector(actorUserId, id, data) {
  const existing = await getSectorById(id);

  await query(
    `UPDATE sectors SET name = ?, geo_description = ? WHERE id = ? AND deleted_at IS NULL`,
    [
      data.name ?? existing.name,
      data.geoDescription !== undefined ? data.geoDescription : existing.geoDescription,
      id,
    ],
  );

  const updated = await getSectorById(id);

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'sector_updated',
      entityType: 'sector',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    },
  );

  return updated;
}

async function softDeleteSector(actorUserId, id) {
  const existing = await getSectorById(id);

  await query(
    `UPDATE sectors SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );

  await writeAudit(
    { query },
    {
      actorUserId,
      action: 'sector_deleted',
      entityType: 'sector',
      entityId: id,
      oldValue: existing,
    },
  );

  return { id, deleted: true };
}

module.exports = {
  createSector,
  listSectors,
  getSectorById,
  updateSector,
  softDeleteSector,
};
