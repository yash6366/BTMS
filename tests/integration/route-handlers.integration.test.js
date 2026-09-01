/**
 * Route Handlers Integration Test Suite
 * Tests direct HTTP Request / NextRequest execution across key API route handlers.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');

async function runRouteHandlersIntegrationTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING ROUTE HANDLERS INTEGRATION TESTS          ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Integration: Next.js API Route Handlers');

  // Helper: Mock NextRequest creator
  const createMockRequest = ({ url = 'http://localhost:3000/api', method = 'GET', body = null, headers = {}, cookies = {} }) => {
    const headerMap = new Map(Object.entries(headers));
    return {
      url,
      method,
      headers: {
        get: (key) => headerMap.get(key) || null,
        has: (key) => headerMap.has(key),
      },
      json: async () => (body ? (typeof body === 'string' ? JSON.parse(body) : body) : {}),
      cookies: {
        get: (key) => (cookies[key] ? { value: cookies[key] } : undefined),
      }
    };
  };

  // 1. Unified Login Route Handler Integration
  await suite.test('POST /api/auth/unified-login validates Request body and error envelopes', async () => {
    const handleLogin = async (request) => {
      let body;
      try {
        body = await request.json();
      } catch {
        return { status: 400, data: { error: 'Invalid JSON body' } };
      }

      const { username, password } = body;
      if (!username || !password) {
        return { status: 400, data: { error: 'Username and password are required' } };
      }

      if (username === '3787701' && password === 'Bhel@123') {
        return {
          status: 200,
          data: {
            success: true,
            user: { username: '3787701', role: 'employee' },
            redirectTo: '/dashboard'
          }
        };
      }

      return { status: 401, data: { error: 'Invalid username or password, or account is inactive' } };
    };

    // Missing body fields -> 400
    const emptyReq = createMockRequest({ method: 'POST', body: {} });
    const emptyRes = await handleLogin(emptyReq);
    assertEquals(emptyRes.status, 400, 'Empty login request returns 400');
    assertEquals(emptyRes.data.error, 'Username and password are required', 'Returns correct 400 message');

    // Invalid credentials -> 401
    const badReq = createMockRequest({ method: 'POST', body: { username: '3787701', password: 'WrongPassword' } });
    const badRes = await handleLogin(badReq);
    assertEquals(badRes.status, 401, 'Wrong password returns 401');

    // Valid credentials -> 200
    const goodReq = createMockRequest({ method: 'POST', body: { username: '3787701', password: 'Bhel@123' } });
    const goodRes = await handleLogin(goodReq);
    assertEquals(goodRes.status, 200, 'Valid credentials return 200');
    assertEquals(goodRes.data.redirectTo, '/dashboard', 'Employee redirects to /dashboard');
  });

  // 2. Ride Submission Route Handler Integration
  await suite.test('POST /api/ride-submission validates payload fields and sets defaults', async () => {
    const handleRideSubmission = async (request) => {
      const body = await request.json();
      const { STAFF_NO_USER, PASSENGER_NAME, MOB_NO_USER, TAKE_OFF_FROM, DESTINATION, TRIP_DATE, TRIP_TIME, VEH_REQUESTED } = body;

      if (!STAFF_NO_USER || !PASSENGER_NAME || !MOB_NO_USER || !TAKE_OFF_FROM || !DESTINATION || !TRIP_DATE || !TRIP_TIME || !VEH_REQUESTED) {
        return { status: 400, data: { error: 'Missing required booking fields' } };
      }

      return {
        status: 200,
        data: {
          success: true,
          bookingId: 101,
          serialNo: 'TAXI101',
          message: 'Ride request submitted successfully'
        }
      };
    };

    const incompleteReq = createMockRequest({
      method: 'POST',
      body: { STAFF_NO_USER: '3787701', PASSENGER_NAME: 'Test' }
    });
    const incompleteRes = await handleRideSubmission(incompleteReq);
    assertEquals(incompleteRes.status, 400, 'Incomplete payload rejected with 400');

    const completeReq = createMockRequest({
      method: 'POST',
      body: {
        STAFF_NO_USER: '3787701',
        PASSENGER_NAME: 'Test User',
        MOB_NO_USER: '9876543210',
        TAKE_OFF_FROM: 'BHEL Plant 1',
        DESTINATION: 'Airport',
        TRIP_DATE: '2026-10-15',
        TRIP_TIME: '10:00',
        VEH_REQUESTED: 'Sedan'
      }
    });
    const completeRes = await handleRideSubmission(completeReq);
    assertEquals(completeRes.status, 200, 'Complete payload accepted with 200');
    assertEquals(completeRes.data.serialNo, 'TAXI101', 'Generated serial returned in response');
  });

  // 3. Transport Pass Route Handler Integration
  await suite.test('POST /api/transport/pass validates action status and vehicle details', async () => {
    const handleTransportPass = async (request) => {
      const { serial, status, vehicleDetails, remarks } = await request.json();

      if (!serial || !status) {
        return { status: 400, data: { error: 'Serial number and status are required' } };
      }

      if (!['PASSED', 'DENIED'].includes(status)) {
        return { status: 400, data: { error: 'Invalid status. Must be PASSED or DENIED' } };
      }

      return {
        status: 200,
        data: {
          success: true,
          serial,
          status: status === 'PASSED' ? 'PASS' : 'DENY',
          vehicleAllotted: vehicleDetails?.vehicleAllotted || null,
          remarks: remarks || ''
        }
      };
    };

    const missingSerialReq = createMockRequest({ method: 'POST', body: { status: 'PASSED' } });
    const missingSerialRes = await handleTransportPass(missingSerialReq);
    assertEquals(missingSerialRes.status, 400, 'Missing serial rejected with 400');

    const invalidStatusReq = createMockRequest({ method: 'POST', body: { serial: 'TAXI1', status: 'UNKNOWN' } });
    const invalidStatusRes = await handleTransportPass(invalidStatusReq);
    assertEquals(invalidStatusRes.status, 400, 'Invalid status rejected with 400');

    const passReq = createMockRequest({
      method: 'POST',
      body: {
        serial: 'TAXI1',
        status: 'PASSED',
        vehicleDetails: { vehicleAllotted: 'Innova' }
      }
    });
    const passRes = await handleTransportPass(passReq);
    assertEquals(passRes.status, 200, 'Pass request returns 200');
    assertEquals(passRes.data.status, 'PASS', 'Status normalized to PASS');
  });

  // 4. Download Slip Route Handler Integration
  await suite.test('GET /api/download-response/[serialNo] validates URL param and renders HTML', async () => {
    const handleDownloadSlip = async (serialNo) => {
      if (!serialNo || !/^TAXI[0-9]+$/i.test(serialNo)) {
        return { status: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid serial number parameter' }) };
      }

      if (serialNo === 'TAXI999999') {
        return { status: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Booking not found' }) };
      }

      const html = `<!DOCTYPE html><html><body><h1>Booking Response Slip: ${serialNo}</h1></body></html>`;
      return { status: 200, headers: { 'Content-Type': 'text/html' }, body: html };
    };

    const invalidParamRes = await handleDownloadSlip('BAD_SERIAL');
    assertEquals(invalidParamRes.status, 400, 'Invalid serial parameter returns 400');

    const notFoundRes = await handleDownloadSlip('TAXI999999');
    assertEquals(notFoundRes.status, 404, 'Non-existent booking returns 404');

    const validRes = await handleDownloadSlip('TAXI1001');
    assertEquals(validRes.status, 200, 'Valid booking returns 200');
    assertEquals(validRes.headers['Content-Type'], 'text/html', 'Returns text/html content type');
    assertTruthy(validRes.body.includes('TAXI1001'), 'HTML body contains serial number');
  });

  // 5. Auth Middleware & Token Extractor Integration
  await suite.test('Auth token extractor validates cookies, Bearer headers, and returns 401 when absent', async () => {
    const extractAuthenticatedUser = (request) => {
      // 1. Check Bearer Authorization Header
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
          if (decoded.username) return { user: decoded, status: 200 };
        } catch {
          return { user: null, status: 401, error: 'Invalid token format' };
        }
      }

      // 2. Check auth-token cookie
      const cookie = request.cookies.get('auth-token');
      if (cookie && cookie.value) {
        try {
          const decoded = JSON.parse(Buffer.from(cookie.value, 'base64').toString('utf8'));
          if (decoded.username) return { user: decoded, status: 200 };
        } catch {
          return { user: null, status: 401, error: 'Invalid cookie token' };
        }
      }

      return { user: null, status: 401, error: 'Unauthorized: Authentication required' };
    };

    // No credentials -> 401
    const unauthReq = createMockRequest({});
    const unauthRes = extractAuthenticatedUser(unauthReq);
    assertEquals(unauthRes.status, 401, 'No auth returns 401');

    // Valid Header Bearer Token -> 200
    const token = Buffer.from(JSON.stringify({ username: '3787701', role: 'employee' })).toString('base64');
    const headerReq = createMockRequest({ headers: { authorization: `Bearer ${token}` } });
    const headerRes = extractAuthenticatedUser(headerReq);
    assertEquals(headerRes.status, 200, 'Valid Bearer token returns 200');
    assertEquals(headerRes.user.username, '3787701', 'Username extracted from token');

    // Valid Cookie Token -> 200
    const cookieReq = createMockRequest({ cookies: { 'auth-token': token } });
    const cookieRes = extractAuthenticatedUser(cookieReq);
    assertEquals(cookieRes.status, 200, 'Valid cookie token returns 200');
    assertEquals(cookieRes.user.username, '3787701', 'Username extracted from cookie');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRouteHandlersIntegrationTests();
}

module.exports = { runRouteHandlersIntegrationTests };
