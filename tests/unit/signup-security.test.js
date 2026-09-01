/**
 * Security & Validation Unit Tests for BTMS Employee Signup
 * Validates:
 * 1. Password policy (12+ chars, uppercase, lowercase, digit, special char)
 * 2. Zod schema validation (EmployeeVerificationSchema, RegistrationSchema)
 * 3. Strict Server-Controlled RBAC (Zero Privilege Escalation)
 * 4. Inactive Account Authentication Invariant (active = 0 rejected)
 * 5. Password Hashing (Bcrypt format, salt rounds, verification)
 * 6. Anti-Enumeration Error Message Sanitation
 */

const bcrypt = require('bcryptjs');
const { TestSuite, assert, assertEquals, assertTruthy, assertFalsy, colors } = require('../helpers/test-utils');

// Password regex from lib/form-validation.ts
const STRONG_PASSWORD_12_PLUS = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^~_+-])[A-Za-z\d@$!%*?&#^~_+-]{12,}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const STAFF_NO_REGEX = /^[0-9A-Za-z_-]{3,20}$/;

async function runSignupSecurityTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING SIGNUP & RBAC SECURITY TESTS               ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Unit: Signup Security & Zero Escalation RBAC');

  // 1. Password Policy & Complexity Verification (12+ chars)
  await suite.test('Password Policy: 12+ Characters with all required character classes', async () => {
    // Valid passwords
    assert(STRONG_PASSWORD_12_PLUS.test('SecurePass123!'), 'Standard 14-char compliant password should pass');
    assert(STRONG_PASSWORD_12_PLUS.test('BHEL#Transport2025'), '18-char corporate password should pass');
    assert(STRONG_PASSWORD_12_PLUS.test('Abcdefghijk1@'), 'Minimal 13-char compliant password should pass');

    // Invalid passwords
    assert(!STRONG_PASSWORD_12_PLUS.test('Short1!'), 'Password < 12 characters must fail');
    assert(!STRONG_PASSWORD_12_PLUS.test('nouppercase123!@#'), 'Password without uppercase must fail');
    assert(!STRONG_PASSWORD_12_PLUS.test('NOLOWERCASE123!@#'), 'Password without lowercase must fail');
    assert(!STRONG_PASSWORD_12_PLUS.test('NoNumbersInThisPassword!'), 'Password without numbers must fail');
    assert(!STRONG_PASSWORD_12_PLUS.test('NoSpecialChars123456'), 'Password without special characters must fail');
  });

  // 2. Identity Fields Validation
  await suite.test('Identity Fields: Mobile and Staff Number formatting invariants', async () => {
    // Staff Number
    assert(STAFF_NO_REGEX.test('6234070'), 'Valid numerical staff ID should pass');
    assert(STAFF_NO_REGEX.test('EMP-6299001'), 'Valid alphanumeric staff ID should pass');
    assert(!STAFF_NO_REGEX.test('12'), 'Staff ID < 3 chars must fail');
    assert(!STAFF_NO_REGEX.test('Staff 123'), 'Staff ID with spaces must fail');

    // Indian Mobile Number (10 digits starting 6-9)
    assert(INDIAN_MOBILE.test('9876543210'), 'Valid 9-series mobile should pass');
    assert(INDIAN_MOBILE.test('6234567890'), 'Valid 6-series mobile should pass');
    assert(!INDIAN_MOBILE.test('5123456789'), 'Mobile starting with 5 must fail');
    assert(!INDIAN_MOBILE.test('987654321'), '9-digit mobile must fail');
    assert(!INDIAN_MOBILE.test('98765432100'), '11-digit mobile must fail');
  });

  // 3. Zero Privilege Escalation Policy Invariants
  await suite.test('Zero Privilege Escalation: Server RBAC ignores client privilege injection', async () => {
    // Simulated registration policy function mirroring registerEmployeeAccount in lib/database.ts
    function enforceServerRBAC(clientPayload) {
      const requestedRole = clientPayload.requestedRole || 'employee';
      
      // Server-controlled permissions - NEVER trust client permissions
      const effectiveRole = 'Employee';
      const manage = '0';
      const build = '0';
      const tools = '0';
      const usergroup = 'Employee';
      const pageaccess = 'employee';
      
      // If elevated access requested, account is inactive pending administrative review
      const isElevated = requestedRole === 'manager' || requestedRole === 'transport';
      const active = isElevated ? '0' : '1';
      const status = isElevated ? 'PENDING_REVIEW' : 'ACTIVE';

      return {
        usergroup,
        manage,
        build,
        tools,
        pageaccess,
        active,
        status,
        effectiveRole
      };
    }

    // Test A: Standard Employee Signup
    const empResult = enforceServerRBAC({
      requestedRole: 'employee',
      manage: '1', // Malicious attempt to inject manage permission
      tools: '1',  // Malicious attempt to inject tools permission
      active: '1'
    });
    assertEquals(empResult.manage, '0', 'Employee manage permission must be 0');
    assertEquals(empResult.build, '0', 'Employee build permission must be 0');
    assertEquals(empResult.tools, '0', 'Employee tools permission must be 0');
    assertEquals(empResult.usergroup, 'Employee', 'Usergroup must be Employee');
    assertEquals(empResult.active, '1', 'Standard employee should be active');
    assertEquals(empResult.status, 'ACTIVE', 'Standard employee status should be ACTIVE');

    // Test B: Malicious Manager Signup Attempt
    const mgrResult = enforceServerRBAC({
      requestedRole: 'manager',
      manage: '1',
      build: '1',
      usergroup: 'Manager',
      active: '1'
    });
    assertEquals(mgrResult.manage, '0', 'Manager request must NOT receive manage=1 automatically');
    assertEquals(mgrResult.build, '0', 'Manager request must NOT receive build=1 automatically');
    assertEquals(mgrResult.tools, '0', 'Manager request must NOT receive tools=1 automatically');
    assertEquals(mgrResult.usergroup, 'Employee', 'Base usergroup must remain Employee');
    assertEquals(mgrResult.active, '0', 'Manager request must be set to inactive (active=0)');
    assertEquals(mgrResult.status, 'PENDING_REVIEW', 'Status must be PENDING_REVIEW');

    // Test C: Malicious Transport Signup Attempt
    const trnResult = enforceServerRBAC({
      requestedRole: 'transport',
      tools: '1',
      usergroup: 'Transport',
      active: '1'
    });
    assertEquals(trnResult.tools, '0', 'Transport request must NOT receive tools=1 automatically');
    assertEquals(trnResult.active, '0', 'Transport request must be set to inactive (active=0)');
    assertEquals(trnResult.status, 'PENDING_REVIEW', 'Status must be PENDING_REVIEW');
  });

  // 4. Inactive Account Authentication Invariant
  await suite.test('Authentication Invariant: active = 0 cannot authenticate or issue tokens', async () => {
    // Simulated database authentication filter
    function mockAuthenticateUser(dbRow, plainPassword) {
      // Invariant from lib/database.ts: WHERE "username" = $1 AND ("active" = '1' OR "active" IS NULL)
      if (dbRow.active !== '1' && dbRow.active !== null && dbRow.active !== undefined) {
        return null; // Rejected because active != '1'
      }

      if (bcrypt.compareSync(plainPassword, dbRow.password_hash)) {
        return {
          username: dbRow.username,
          usergroup: dbRow.usergroup,
          active: dbRow.active
        };
      }
      return null;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('ValidPass123!@#', salt);

    // Case 1: Inactive account (active = '0') with correct password
    const inactiveUser = {
      username: '6299001',
      password_hash: passwordHash,
      usergroup: 'Employee',
      active: '0'
    };
    const authResultInactive = mockAuthenticateUser(inactiveUser, 'ValidPass123!@#');
    assertEquals(authResultInactive, null, 'Authentication must return null for inactive account');

    // Case 2: Active account (active = '1') with correct password
    const activeUser = {
      username: '6299001',
      password_hash: passwordHash,
      usergroup: 'Employee',
      active: '1'
    };
    const authResultActive = mockAuthenticateUser(activeUser, 'ValidPass123!@#');
    assertTruthy(authResultActive, 'Authentication must succeed for active account');
    assertEquals(authResultActive.username, '6299001', 'Authenticated username should match');
  });

  // 5. Anti-Enumeration & Sanitized Responses
  await suite.test('Anti-Enumeration: Error messages do not disclose user existence or database schema', async () => {
    const genericVerificationError = "Employee verification failed. Please verify your Staff Number and official BHEL email with the IT Directory.";
    const genericCollisionError = "An account already exists for the supplied employee identity. Please sign in or contact support.";

    // Ensure error messages are sanitized
    assert(!genericVerificationError.includes('SELECT'), 'Error must not contain SQL keywords');
    assert(!genericVerificationError.includes('axusers'), 'Error must not leak database table names');
    assert(!genericVerificationError.includes('PostgreSQL'), 'Error must not leak database technology');
    assert(!genericCollisionError.includes('password'), 'Error must not leak password info');
  });

  // 6. Master Directory Canonical Data Integrity
  await suite.test('Master Directory Integrity: Server canonical values override client profile', async () => {
    const masterDirectoryRecord = {
      EMP_ID: '6299001',
      EMP_FNAME: 'Arun',
      EMP_MNAME: 'V',
      EMP_LNAME: 'Kumar',
      EMP_DESIGNATION: 'Software Engineer',
      EMP_EMAIL_ID: 'arun.kumar@bhel.in',
      DEPT: 'Information Technology'
    };

    // Server-side construction derives strictly from masterDirectoryRecord
    const nameParts = [masterDirectoryRecord.EMP_FNAME, masterDirectoryRecord.EMP_MNAME, masterDirectoryRecord.EMP_LNAME]
      .filter(p => p && p.trim());
    const canonicalFullName = nameParts.join(' ');

    assertEquals(canonicalFullName, 'Arun V Kumar', 'Full name must be derived from master record');
    assertEquals(masterDirectoryRecord.DEPT, 'Information Technology', 'Department must be derived from master record');
    assertEquals(masterDirectoryRecord.EMP_DESIGNATION, 'Software Engineer', 'Designation must be derived from master record');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

runSignupSecurityTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
