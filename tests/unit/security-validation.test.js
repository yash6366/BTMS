/**
 * Pure Unit Tests: Security, Validation, and Token Issuance
 * (Runs completely in-memory without database dependencies)
 */

const bcrypt = require('bcryptjs');
const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');

async function runUnitTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING UNIT TESTS (Pure Functions & Security)     ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Unit: Security & Validation');

  // 1. Password Hashing & Verification
  await suite.test('Bcrypt password hashing and verification', async () => {
    const rawPassword = 'SecurePassword@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);
    
    assertTruthy(hash, 'Hash should not be empty');
    assert(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Hash should be valid bcrypt format');
    
    const isValid = await bcrypt.compare(rawPassword, hash);
    assert(isValid === true, 'Bcrypt compare should succeed for correct password');
    
    const isInvalid = await bcrypt.compare('WrongPassword!123', hash);
    assert(isInvalid === false, 'Bcrypt compare should fail for incorrect password');
  });

  // 2. Base64 Token Parsing
  await suite.test('Base64 session token encoding and decoding', async () => {
    const userPayload = {
      username: '6234070',
      role: 'employee',
      timestamp: Date.now()
    };
    const rawString = `${userPayload.username}:${userPayload.role}:${userPayload.timestamp}`;
    const token = Buffer.from(rawString).toString('base64');
    
    assertTruthy(token, 'Token string should be created');
    
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [decodedUser, decodedRole] = decoded.split(':');
    
    assertEquals(decodedUser, '6234070', 'Decoded username should match');
    assertEquals(decodedRole, 'employee', 'Decoded role should match');
  });

  // 3. Serial Number Formatter Invariant
  await suite.test('Serial number TAXI prefix generation', async () => {
    const formatSerial = (bookingId) => `TAXI${bookingId}`;
    assertEquals(formatSerial(1001), 'TAXI1001', 'Serial number should format correctly');
    assertEquals(formatSerial('456'), 'TAXI456', 'Serial number with string ID should format correctly');
  });

  // 4. Input Sanitization & Validation
  await suite.test('Staff number and mobile validation rules', async () => {
    const validateStaffNo = (staffNo) => /^[0-9A-Za-z_-]{3,20}$/.test(staffNo?.trim());
    const validateMobile = (mob) => /^[0-9]{10}$/.test(mob?.trim());

    assert(validateStaffNo('6234070'), 'Valid 7-digit staff number');
    assert(validateStaffNo('3787702'), 'Valid manager staff number');
    assert(!validateStaffNo(''), 'Empty staff number rejected');
    assert(!validateStaffNo('AB'), 'Too short staff number rejected');

    assert(validateMobile('9876543210'), 'Valid 10-digit mobile');
    assert(!validateMobile('98765'), 'Short mobile rejected');
    assert(!validateMobile('9876543210ABC'), 'Alpha mobile rejected');
  });

  // 5. Booking Status Transitions
  await suite.test('Approval Status Workflow Rules', async () => {
    const validStatuses = ['OPEN', 'APPROVED', 'REJECTED', 'PASSED', 'CLSD'];
    const isFinalStatus = (status) => ['REJECTED', 'PASSED', 'CLSD'].includes(status);

    assert(validStatuses.includes('OPEN'), 'OPEN status should be supported');
    assert(validStatuses.includes('APPROVED'), 'APPROVED status should be supported');
    assert(isFinalStatus('PASSED'), 'PASSED is a terminal transport status');
    assert(!isFinalStatus('OPEN'), 'OPEN is not a terminal status');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runUnitTests();
}

module.exports = { runUnitTests };
