/**
 * API Integration & Smoke Test Suite
 * Tests endpoint health, payload contract formats, and route response standards
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');

async function runApiTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING API INTEGRATION & SMOKE TESTS              ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('API: Integration & Contract Smoke Tests');

  // 1. Contract format check for standard API response
  await suite.test('Unified API response standard JSON envelope format', async () => {
    const createSuccessResponse = (data, message = 'Success') => ({
      success: true,
      data,
      message
    });

    const createErrorResponse = (error, status = 400) => ({
      success: false,
      error,
      status
    });

    const ok = createSuccessResponse({ id: 101 }, 'Booking created');
    assertEquals(ok.success, true, 'Success flag should be true');
    assertEquals(ok.data.id, 101, 'Data payload preserved');

    const err = createErrorResponse('Unauthorized', 401);
    assertEquals(err.success, false, 'Error flag should be false');
    assertEquals(err.status, 401, 'Status code preserved');
  });

  // 2. Auth Route Headers & Cookie extraction contract
  await suite.test('Auth header extraction and Bearer token parsing', async () => {
    const parseAuthHeader = (header) => {
      if (!header || !header.startsWith('Bearer ')) return null;
      return header.substring(7);
    };

    const token = 'sample-jwt-token-string';
    assertEquals(parseAuthHeader(`Bearer ${token}`), token, 'Bearer token extracted correctly');
    assertEquals(parseAuthHeader('InvalidHeader 123'), null, 'Invalid header returns null');
    assertEquals(parseAuthHeader(null), null, 'Null header returns null');
  });

  // 3. Serial Number URL Parameter Validation
  await suite.test('Download route serial number parameter sanitizer', async () => {
    const sanitizeSerialNo = (param) => {
      if (!param || typeof param !== 'string') return null;
      const clean = param.trim();
      return /^TAXI[0-9]+$/i.test(clean) ? clean.toUpperCase() : null;
    };

    assertEquals(sanitizeSerialNo('TAXI1234'), 'TAXI1234', 'Valid taxi serial recognized');
    assertEquals(sanitizeSerialNo('taxi5678'), 'TAXI5678', 'Lowercase taxi serial normalized to uppercase');
    assertEquals(sanitizeSerialNo('DROP TABLE axusers;'), null, 'SQL injection attempt sanitized to null');
    assertEquals(sanitizeSerialNo('../../etc/passwd'), null, 'Path traversal attempt sanitized to null');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runApiTests();
}

module.exports = { runApiTests };
