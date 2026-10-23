// Append one audit log row for every important change.

const { randomUUID } = require('crypto');

async function writeAudit(db, { actorUserId, action, entityType, entityId, oldValue, newValue }) {
  const id = randomUUID();

  await db.query(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      actorUserId || null,
      action,
      entityType,
      entityId,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
    ],
  );

  return id;
}

module.exports = { writeAudit };
