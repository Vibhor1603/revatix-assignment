// Seed demo users and a small catalog for local testing.

require('dotenv').config();

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');

async function upsertUser(user, passwordHash) {
  await pool.execute(
    `INSERT INTO users (id, name, email, password_hash, role, employee_code)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = VALUES(role),
       employee_code = VALUES(employee_code),
       deleted_at = NULL`,
    [user.id, user.name, user.email, passwordHash, user.role, user.employee_code],
  );
}

async function seed() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  await upsertUser(
    {
      id: randomUUID(),
      name: 'Ops Manager',
      email: 'manager@isp.local',
      role: 'manager',
      employee_code: null,
    },
    passwordHash,
  );

  await upsertUser(
    {
      id: randomUUID(),
      name: 'Support Agent',
      email: 'support@isp.local',
      role: 'support',
      employee_code: null,
    },
    passwordHash,
  );

  await upsertUser(
    {
      id: randomUUID(),
      name: 'Field Tech',
      email: 'tech@isp.local',
      role: 'technician',
      employee_code: 'TECH-001',
    },
    passwordHash,
  );

  const [planCount] = await pool.execute(
    `SELECT COUNT(*) AS total FROM service_plans WHERE deleted_at IS NULL`,
  );

  if (Number(planCount[0].total) === 0) {
    await pool.execute(
      `INSERT INTO service_plans (id, name, bandwidth_mbps, price)
       VALUES (?, 'Fiber 100', 100, 999.00)`,
      [randomUUID()],
    );
  }

  const [popRows] = await pool.execute(
    `SELECT id FROM pops WHERE code = 'POP-BLR-01' AND deleted_at IS NULL LIMIT 1`,
  );

  if (!popRows.length) {
    await pool.execute(
      `INSERT INTO pops (id, code, name, location)
       VALUES (?, 'POP-BLR-01', 'Bangalore Hub 1', 'Bengaluru')`,
      [randomUUID()],
    );
  }

  const [sectorCount] = await pool.execute(
    `SELECT COUNT(*) AS total FROM sectors WHERE deleted_at IS NULL`,
  );

  if (Number(sectorCount[0].total) === 0) {
    await pool.execute(
      `INSERT INTO sectors (id, name, geo_description)
       VALUES (?, 'Koramangala East', 'Sector for east routing')`,
      [randomUUID()],
    );
  }

  console.log('Seed complete.');
  console.log('Users (password for all: Password123!):');
  console.log('  manager@isp.local');
  console.log('  support@isp.local');
  console.log('  tech@isp.local');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
