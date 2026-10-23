// End-to-end verification of happy path and key edge cases.

const BASE = process.env.API_BASE || 'http://127.0.0.1:4000/api/v1';

let passed = 0;
let failed = 0;

async function request(method, path, { token, body, expectStatus } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (expectStatus != null && res.status !== expectStatus) {
    throw new Error(
      `${method} ${path} expected ${expectStatus} got ${res.status}: ${text}`,
    );
  }

  return { status: res.status, data };
}

function ok(name) {
  passed += 1;
  console.log(`PASS  ${name}`);
}

function fail(name, error) {
  failed += 1;
  console.error(`FAIL  ${name}`);
  console.error(`      ${error.message || error}`);
}

async function run() {
  console.log(`Verifying against ${BASE}\n`);

  let managerToken;
  let supportToken;
  let techToken;
  let techId;
  let planId;
  let popId;
  let sectorId;
  let connectionId;
  let ticketId;
  let taskA;
  let taskB;

  try {
    const badLogin = await request('POST', '/auth/login', {
      body: { email: 'manager@isp.local', password: 'wrong-password' },
      expectStatus: 401,
    });
    ok('login rejects bad password');
  } catch (error) {
    fail('login rejects bad password', error);
  }

  try {
    await request('POST', '/auth/login', {
      body: { email: 'not-an-email', password: 'short' },
      expectStatus: 400,
    });
    ok('login Zod validation');
  } catch (error) {
    fail('login Zod validation', error);
  }

  try {
    const login = await request('POST', '/auth/login', {
      body: { email: 'manager@isp.local', password: 'Password123!' },
      expectStatus: 200,
    });
    managerToken = login.data.accessToken;
    ok('manager login');
  } catch (error) {
    fail('manager login', error);
    console.error('Cannot continue without manager token');
    process.exit(1);
  }

  try {
    const login = await request('POST', '/auth/login', {
      body: { email: 'support@isp.local', password: 'Password123!' },
      expectStatus: 200,
    });
    supportToken = login.data.accessToken;
    ok('support login');
  } catch (error) {
    fail('support login', error);
  }

  try {
    const login = await request('POST', '/auth/login', {
      body: { email: 'tech@isp.local', password: 'Password123!' },
      expectStatus: 200,
    });
    techToken = login.data.accessToken;
    techId = login.data.user.id;
    ok('technician login');
  } catch (error) {
    fail('technician login', error);
  }

  try {
    const first = await request('POST', '/auth/login', {
      body: { email: 'manager@isp.local', password: 'Password123!' },
      expectStatus: 200,
    });
    const refreshed = await request('POST', '/auth/refresh', {
      body: { refreshToken: first.data.refreshToken },
      expectStatus: 200,
    });
    if (!refreshed.data.accessToken) {
      throw new Error('missing accessToken after refresh');
    }
    ok('refresh token rotation');
  } catch (error) {
    fail('refresh token rotation', error);
  }

  try {
    await request('GET', '/auth/me', { token: managerToken, expectStatus: 200 });
    ok('auth me');
  } catch (error) {
    fail('auth me', error);
  }

  try {
    await request('GET', '/plans', { expectStatus: 401 });
    ok('protected route without token');
  } catch (error) {
    fail('protected route without token', error);
  }

  try {
    const plan = await request('POST', '/plans', {
      token: managerToken,
      body: { name: 'Fiber 200', bandwidthMbps: 200, price: 1499 },
      expectStatus: 201,
    });
    planId = plan.data.id;
    ok('create plan');
  } catch (error) {
    fail('create plan', error);
  }

  try {
    const pop = await request('POST', '/pops', {
      token: managerToken,
      body: { code: `POP-T-${Date.now()}`, name: 'Test POP', location: 'Test' },
      expectStatus: 201,
    });
    popId = pop.data.id;
    ok('create pop');
  } catch (error) {
    fail('create pop', error);
  }

  try {
    const sector = await request('POST', '/sectors', {
      token: managerToken,
      body: { name: 'Test Sector', geoDescription: 'Verify area' },
      expectStatus: 201,
    });
    sectorId = sector.data.id;
    ok('create sector');
  } catch (error) {
    fail('create sector', error);
  }

  try {
    await request('POST', '/connections', {
      token: supportToken,
      body: {
        customerName: 'Blocked',
        phone: '999',
        planId,
        popId,
        sectorId,
      },
      expectStatus: 403,
    });
    ok('support cannot create connection');
  } catch (error) {
    fail('support cannot create connection', error);
  }

  try {
    const conn = await request('POST', '/connections', {
      token: managerToken,
      body: {
        customerName: 'Verify Customer',
        phone: '9876543210',
        email: 'cust@example.com',
        address: 'Test Address',
        planId,
        popId,
        sectorId,
        status: 'Active',
      },
      expectStatus: 201,
    });
    connectionId = conn.data.id;
    ok('create connection');
  } catch (error) {
    fail('create connection', error);
  }

  try {
    await request('GET', `/connections?status=Active&page=1`, {
      token: managerToken,
      expectStatus: 200,
    });
    ok('list connections with filters');
  } catch (error) {
    fail('list connections with filters', error);
  }

  try {
    await request('POST', '/tickets', {
      token: techToken,
      body: {
        connectionId,
        title: 'Should fail',
        slaDueAt: '2026-10-24 18:00:00',
      },
      expectStatus: 403,
    });
    ok('technician cannot create ticket');
  } catch (error) {
    fail('technician cannot create ticket', error);
  }

  try {
    const ticket = await request('POST', '/tickets', {
      token: supportToken,
      body: {
        connectionId,
        title: 'Speed issue',
        description: 'Slow evenings',
        complaintType: 'speed_degradation',
        priority: 'high',
        slaDueAt: '2026-10-24 18:00:00',
      },
      expectStatus: 201,
    });
    ticketId = ticket.data.id;
    ok('support create ticket');
  } catch (error) {
    fail('support create ticket', error);
  }

  try {
    const a = await request('POST', `/tickets/${ticketId}/tasks`, {
      token: supportToken,
      body: { taskType: 'Feeder Line Check' },
      expectStatus: 201,
    });
    taskA = a.data.id;
    const b = await request('POST', `/tickets/${ticketId}/tasks`, {
      token: supportToken,
      body: { taskType: 'ONU Configuration' },
      expectStatus: 201,
    });
    taskB = b.data.id;
    ok('create two tasks under ticket');
  } catch (error) {
    fail('create two tasks under ticket', error);
  }

  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 20 + Math.floor(Math.random() * 50));
  const shiftDate = day.toISOString().slice(0, 10);

  try {
    await request('POST', `/technicians/${techId}/shifts`, {
      token: managerToken,
      body: {
        shiftDate,
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      expectStatus: 201,
    });
    ok('create shift');
  } catch (error) {
    fail('create shift', error);
  }

  try {
    await request('POST', `/technicians/${techId}/shifts`, {
      token: managerToken,
      body: {
        shiftDate,
        startTime: '22:00:00',
        endTime: '06:00:00',
      },
      expectStatus: 400,
    });
    ok('reject overnight shift');
  } catch (error) {
    fail('reject overnight shift', error);
  }

  try {
    await request('POST', `/tasks/${taskA}/assign`, {
      token: supportToken,
      body: {
        technicianId: techId,
        scheduledStart: `${shiftDate} 10:00:00`,
        scheduledEnd: `${shiftDate} 12:00:00`,
      },
      expectStatus: 200,
    });
    ok('assign task A');
  } catch (error) {
    fail('assign task A', error);
  }

  try {
    await request('POST', `/tasks/${taskB}/assign`, {
      token: supportToken,
      body: {
        technicianId: techId,
        scheduledStart: `${shiftDate} 11:00:00`,
        scheduledEnd: `${shiftDate} 13:00:00`,
      },
      expectStatus: 400,
    });
    ok('reject overlapping assign');
  } catch (error) {
    fail('reject overlapping assign', error);
  }

  try {
    await request('POST', `/tasks/${taskB}/assign`, {
      token: supportToken,
      body: {
        technicianId: techId,
        scheduledStart: `${shiftDate} 18:00:00`,
        scheduledEnd: `${shiftDate} 19:00:00`,
      },
      expectStatus: 400,
    });
    ok('reject assign outside shift');
  } catch (error) {
    fail('reject assign outside shift', error);
  }

  try {
    await request('POST', `/tasks/${taskB}/assign`, {
      token: supportToken,
      body: {
        technicianId: techId,
        scheduledStart: `${shiftDate} 13:00:00`,
        scheduledEnd: `${shiftDate} 15:00:00`,
      },
      expectStatus: 200,
    });
    ok('assign task B non-overlapping');
  } catch (error) {
    fail('assign task B non-overlapping', error);
  }

  try {
    await request('PATCH', `/tickets/${ticketId}/status`, {
      token: supportToken,
      body: { status: 'Closed' },
      expectStatus: 400,
    });
    ok('cannot close ticket with open tasks');
  } catch (error) {
    fail('cannot close ticket with open tasks', error);
  }

  try {
    await request('POST', `/tasks/${taskA}/cancel`, {
      token: supportToken,
      expectStatus: 200,
    });
    await request('PATCH', `/tasks/${taskB}/status`, {
      token: supportToken,
      body: { status: 'Closed' },
      expectStatus: 200,
    });
    await request('PATCH', `/tickets/${ticketId}/status`, {
      token: supportToken,
      body: { status: 'Closed' },
      expectStatus: 200,
    });
    ok('close ticket after tasks closed/cancelled');
  } catch (error) {
    fail('close ticket after tasks closed/cancelled', error);
  }

  try {
    const terminated = await request('POST', '/connections', {
      token: managerToken,
      body: {
        customerName: 'Term Customer',
        phone: '111',
        planId,
        popId,
        sectorId,
        status: 'Terminated',
      },
      expectStatus: 201,
    });
    await request('POST', '/tickets', {
      token: supportToken,
      body: {
        connectionId: terminated.data.id,
        title: 'Should fail',
        slaDueAt: '2026-10-25 12:00:00',
      },
      expectStatus: 400,
    });
    ok('no ticket on terminated connection');
  } catch (error) {
    fail('no ticket on terminated connection', error);
  }

  try {
    const audit = await request('GET', '/audit?page=1', {
      token: managerToken,
      expectStatus: 200,
    });
    if (!audit.data.items || audit.data.items.length < 1) {
      throw new Error('expected audit items');
    }
    ok('audit list returns rows');
  } catch (error) {
    fail('audit list returns rows', error);
  }

  console.log(`\nDone. passed=${passed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
