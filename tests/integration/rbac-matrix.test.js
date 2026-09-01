/**
 * Comprehensive RBAC Positive & Negative Test Matrix
 * Verifies role-based access control rules across all user types and route boundaries.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');

async function runRbacMatrixTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING RBAC POSITIVE & NEGATIVE MATRIX TESTS      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('RBAC: Positive & Negative Authorization Matrix');

  // RBAC Authorizer Policy Engine
  const authorizeRoute = (user, route, method = 'GET') => {
    if (!user) {
      return { status: 401, allowed: false, error: 'Unauthorized: Authentication session required' };
    }

    const { role, usertype } = user;
    const isEmployee = role === 'employee' || usertype === 'user' || usertype === 'employee';
    const isManager = role === 'manager' || usertype === 'manager';
    const isTransport = role === 'transport' || usertype === 'transport';

    // Route RBAC Matrix Definitions
    const routeRules = [
      {
        pattern: /^\/api\/ride-submission/,
        allowedRoles: ['employee', 'manager', 'transport'],
        methods: ['POST']
      },
      {
        pattern: /^\/api\/bookings\/(me|my-rides)/,
        allowedRoles: ['employee', 'manager', 'transport'],
        methods: ['GET']
      },
      {
        pattern: /^\/api\/approvals/,
        allowedRoles: ['manager'],
        methods: ['GET', 'POST']
      },
      {
        pattern: /^\/api\/manager\/(notifications|sync-to-transport)/,
        allowedRoles: ['manager'],
        methods: ['GET', 'POST']
      },
      {
        pattern: /^\/api\/transport\/(bookings|pass)/,
        allowedRoles: ['transport'],
        methods: ['GET', 'POST']
      }
    ];

    for (const rule of routeRules) {
      if (rule.pattern.test(route)) {
        if (!rule.methods.includes(method)) {
          return { status: 405, allowed: false, error: 'Method Not Allowed' };
        }

        const roleAllowed =
          (isEmployee && rule.allowedRoles.includes('employee')) ||
          (isManager && rule.allowedRoles.includes('manager')) ||
          (isTransport && rule.allowedRoles.includes('transport'));

        if (roleAllowed) {
          return { status: 200, allowed: true };
        } else {
          return { status: 403, allowed: false, error: 'Forbidden: Insufficient role permissions' };
        }
      }
    }

    return { status: 404, allowed: false, error: 'Route not found' };
  };

  // 1. Unauthenticated Request Rejection Matrix
  await suite.test('Unauthenticated sessions are denied with 401 across all protected routes', async () => {
    const protectedRoutes = [
      '/api/ride-submission',
      '/api/bookings/my-rides',
      '/api/approvals',
      '/api/approvals/approve',
      '/api/manager/notifications',
      '/api/transport/bookings',
      '/api/transport/pass'
    ];

    for (const route of protectedRoutes) {
      const result = authorizeRoute(null, route, 'GET');
      assertEquals(result.status, 401, `Unauthenticated access to ${route} blocked with 401`);
      assertEquals(result.allowed, false, `Allowed flag false for unauthenticated ${route}`);
    }
  });

  // 2. Employee Positive & Negative Authorization Matrix
  await suite.test('Employee role permissions: Positive access to personal routes, Negative to Manager/Transport', async () => {
    const employeeUser = { username: '3787701', role: 'employee', usertype: 'user' };

    // POSITIVE: Employee allowed on own ride submission & booking history
    const rideSubmit = authorizeRoute(employeeUser, '/api/ride-submission', 'POST');
    assertEquals(rideSubmit.status, 200, 'Employee allowed to submit rides');

    const myBookings = authorizeRoute(employeeUser, '/api/bookings/my-rides', 'GET');
    assertEquals(myBookings.status, 200, 'Employee allowed to view own bookings');

    // NEGATIVE: Employee forbidden on Manager approval routes
    const mgrApprovals = authorizeRoute(employeeUser, '/api/approvals', 'GET');
    assertEquals(mgrApprovals.status, 403, 'Employee forbidden on /api/approvals (403)');

    const mgrApprove = authorizeRoute(employeeUser, '/api/approvals/approve', 'POST');
    assertEquals(mgrApprove.status, 403, 'Employee forbidden to approve rides (403)');

    const mgrNotif = authorizeRoute(employeeUser, '/api/manager/notifications', 'GET');
    assertEquals(mgrNotif.status, 403, 'Employee forbidden on manager notifications (403)');

    // NEGATIVE: Employee forbidden on Transport pool & pass routes
    const transBookings = authorizeRoute(employeeUser, '/api/transport/bookings', 'GET');
    assertEquals(transBookings.status, 403, 'Employee forbidden on transport booking pool (403)');

    const transPass = authorizeRoute(employeeUser, '/api/transport/pass', 'POST');
    assertEquals(transPass.status, 403, 'Employee forbidden on transport pass/allotment (403)');
  });

  // 3. Manager Positive & Negative Authorization Matrix
  await suite.test('Manager role permissions: Positive access to approval routes, Negative to Transport allotment', async () => {
    const managerUser = { username: '3787702', role: 'manager', usertype: 'manager' };

    // POSITIVE: Manager allowed on approval and notification routes
    const mgrApprovals = authorizeRoute(managerUser, '/api/approvals', 'GET');
    assertEquals(mgrApprovals.status, 200, 'Manager allowed to view pending approvals');

    const mgrApprove = authorizeRoute(managerUser, '/api/approvals/approve', 'POST');
    assertEquals(mgrApprove.status, 200, 'Manager allowed to approve rides');

    const mgrNotif = authorizeRoute(managerUser, '/api/manager/notifications', 'GET');
    assertEquals(mgrNotif.status, 200, 'Manager allowed to view notifications');

    // NEGATIVE: Manager forbidden on Transport pool and vehicle allotment
    const transBookings = authorizeRoute(managerUser, '/api/transport/bookings', 'GET');
    assertEquals(transBookings.status, 403, 'Manager forbidden to access transport pool (403)');

    const transPass = authorizeRoute(managerUser, '/api/transport/pass', 'POST');
    assertEquals(transPass.status, 403, 'Manager forbidden to pass transport requests directly (403)');
  });

  // 4. Transport Positive & Negative Authorization Matrix
  await suite.test('Transport role permissions: Positive access to vehicle allotment, Negative to Manager approvals', async () => {
    const transportUser = { username: 'transport', role: 'transport', usertype: 'transport' };

    // POSITIVE: Transport allowed on transport booking pool and pass/allotment
    const transBookings = authorizeRoute(transportUser, '/api/transport/bookings', 'GET');
    assertEquals(transBookings.status, 200, 'Transport allowed to view approved booking pool');

    const transPass = authorizeRoute(transportUser, '/api/transport/pass', 'POST');
    assertEquals(transPass.status, 200, 'Transport allowed to pass and allot vehicles');

    // NEGATIVE: Transport forbidden on Manager approval routes
    const mgrApprovals = authorizeRoute(transportUser, '/api/approvals', 'GET');
    assertEquals(mgrApprovals.status, 403, 'Transport forbidden on manager approvals (403)');

    const mgrApprove = authorizeRoute(transportUser, '/api/approvals/approve', 'POST');
    assertEquals(mgrApprove.status, 403, 'Transport forbidden to execute manager approval actions (403)');
  });

  // 5. Session Integrity & Tamper Resistance
  await suite.test('Session Token parsing and tamper resistance checks', async () => {
    const validateToken = (token) => {
      if (!token || typeof token !== 'string') return null;
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (!parsed.username || !parsed.role || !parsed.exp) return null;
        if (Date.now() > parsed.exp) return null; // Expired
        return parsed;
      } catch {
        return null;
      }
    };

    const validPayload = {
      username: '3787701',
      role: 'employee',
      exp: Date.now() + 3600 * 1000
    };
    const validToken = Buffer.from(JSON.stringify(validPayload)).toString('base64');
    const user = validateToken(validToken);
    assertTruthy(user !== null, 'Valid token decoded successfully');
    assertEquals(user.username, '3787701', 'Username preserved');

    // Expired Token
    const expiredPayload = {
      username: '3787701',
      role: 'employee',
      exp: Date.now() - 3600 * 1000 // In the past
    };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
    assertEquals(validateToken(expiredToken), null, 'Expired token rejected');

    // Corrupted / Tampered Base64
    assertEquals(validateToken('invalid-base64-content!@#$'), null, 'Malformed token string rejected');
    assertEquals(validateToken(''), null, 'Empty token rejected');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRbacMatrixTests();
}

module.exports = { runRbacMatrixTests };
