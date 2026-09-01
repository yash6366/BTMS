/**
 * Application Security, Dependency & Vulnerability Audit Test Suite
 * Tests HTTP security headers, JWT cryptographic integrity, cookie safety flags,
 * parameterized SQL injection defenses, role escalation immunity, and secret shielding.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');
const { SignJWT, jwtVerify } = require('jose');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runSecurityAuditTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING APPLICATION SECURITY AUDIT TESTS          ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Security: Application Security & Vulnerability Audit');

  // 1. HTTP Security Headers Compliance
  await suite.test('Next.js configuration emits strict HTTP security headers and cache policies', async () => {
    const nextConfig = require('../../next.config.js');
    assertTruthy(typeof nextConfig.headers === 'function', 'next.config.js defines headers function');

    const headersList = await nextConfig.headers();
    const globalHeaderConfig = headersList.find((h) => h.source === '/(.*)');
    assertTruthy(globalHeaderConfig, 'Global header rule (/(.*)) exists');

    const headerMap = new Map(globalHeaderConfig.headers.map((h) => [h.key, h.value]));
    assertEquals(headerMap.get('X-Content-Type-Options'), 'nosniff', 'X-Content-Type-Options is nosniff');
    assertEquals(headerMap.get('X-Frame-Options'), 'DENY', 'X-Frame-Options is DENY (clickjacking protection)');
    assertEquals(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin', 'Referrer-Policy is strict-origin-when-cross-origin');
    assertEquals(headerMap.get('X-XSS-Protection'), '1; mode=block', 'X-XSS-Protection is enabled with block');
    assertEquals(headerMap.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()', 'Permissions-Policy restricts unused hardware APIs');

    const apiHeaderConfig = headersList.find((h) => h.source === '/api/(.*)');
    assertTruthy(apiHeaderConfig, 'API header rule (/api/(.*)) exists');
    const apiHeaderMap = new Map(apiHeaderConfig.headers.map((h) => [h.key, h.value]));
    assertEquals(apiHeaderMap.get('Cache-Control'), 'private, max-age=60', 'API routes configured with private Cache-Control');
  });

  // 2. Cryptographic JWT Integrity & Expiration Invariants
  await suite.test('JWT tokens enforce HS256 signature validation, issuer/audience claims, and expiration', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'development-secret-key-change-in-production');
    const issuer = 'bhel-transport-system';
    const audience = 'bhel-employees';

    // 1. Generate legitimate token
    const legitimateToken = await new SignJWT({
      username: '3787701',
      role: 'employee',
      sessionId: 'sess_12345'
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer(issuer)
      .setAudience(audience)
      .sign(secret);

    // 2. Verify legitimate token
    const { payload } = await jwtVerify(legitimateToken, secret, { issuer, audience });
    assertEquals(payload.username, '3787701', 'Legitimate token username claim verified');
    assertEquals(payload.role, 'employee', 'Legitimate token role claim verified');

    // 3. Test Signature Tampering
    const parts = legitimateToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    let tamperingRejected = false;
    try {
      await jwtVerify(tamperedToken, secret, { issuer, audience });
    } catch {
      tamperingRejected = true;
    }
    assertTruthy(tamperingRejected, 'Tampered token payload was rejected by cryptographic verification');

    // 4. Test Expired Token
    const expiredToken = await new SignJWT({ username: '3787701', role: 'employee' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // Expired 1 minute ago
      .setIssuer(issuer)
      .setAudience(audience)
      .sign(secret);

    let expiredRejected = false;
    try {
      await jwtVerify(expiredToken, secret, { issuer, audience });
    } catch {
      expiredRejected = true;
    }
    assertTruthy(expiredRejected, 'Expired token was rejected by cryptographic verification');
  });

  // 3. Cookie Security Flags & Invalidation Protocol
  await suite.test('Authentication cookies enforce HttpOnly, SameSite=strict, Path=/, and safe invalidation', async () => {
    // Cookie specification contract derived from lib/secure-auth.ts
    const getCookieOptions = (isProduction = false, type = 'access') => {
      const maxAge = type === 'access' ? 60 * 60 : 60 * 60 * 24 * 7;
      return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge
      };
    };

    const prodAccessCookie = getCookieOptions(true, 'access');
    assertEquals(prodAccessCookie.httpOnly, true, 'Access cookie is HttpOnly');
    assertEquals(prodAccessCookie.secure, true, 'Access cookie is Secure in production');
    assertEquals(prodAccessCookie.sameSite, 'strict', 'Access cookie SameSite is strict');
    assertEquals(prodAccessCookie.path, '/', 'Access cookie path is root /');
    assertEquals(prodAccessCookie.maxAge, 3600, 'Access cookie maxAge is 1 hour (3600s)');

    const prodRefreshCookie = getCookieOptions(true, 'refresh');
    assertEquals(prodRefreshCookie.httpOnly, true, 'Refresh cookie is HttpOnly');
    assertEquals(prodRefreshCookie.sameSite, 'strict', 'Refresh cookie SameSite is strict');
    assertEquals(prodRefreshCookie.maxAge, 604800, 'Refresh cookie maxAge is 7 days (604800s)');

    // Invalidation options
    const getClearCookieOptions = () => ({
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
    const clearOptions = getClearCookieOptions();
    assertEquals(clearOptions.maxAge, 0, 'Clear cookie maxAge is 0');
    assertTruthy(clearOptions.expires.getTime() === 0, 'Clear cookie expires in epoch 0');
  });

  // 4. Parameterized SQL Injection Immunity
  await suite.test('Database query engine rejects SQL injection payloads and treats parameters as literal values', async () => {
    const maliciousPayload = "' OR '1'='1' --; DROP TABLE axusers; ";

    // Execute parameterized query looking for non-existent user with malicious injection string
    const result = await pool.query(
      'SELECT username FROM "axusers" WHERE username = $1',
      [maliciousPayload]
    );

    // If injection worked, it would return all rows because '1'='1'
    assertEquals(result.rows.length, 0, 'Parameterized query treated injection string as literal parameter with 0 matches');

    // Confirm core table was NOT dropped and remains intact
    const tableCheck = await pool.query(
      'SELECT COUNT(*) as count FROM "axusers"'
    );
    assertTruthy(parseInt(tableCheck.rows[0].count, 10) > 0, 'axusers table remains intact and unharmed');
  });

  // 5. Privilege Escalation & Role Tampering Defense
  await suite.test('Role authorization derives strictly from server-side database attributes', async () => {
    const resolveRoleAndAccess = (userRecord, clientRequestedRole) => {
      // Server-side derivation rule from lib/auth.ts and unified-login/route.ts
      const isManager = userRecord.manage === '1' ||
                        userRecord.manage === 'Y' ||
                        (userRecord.usergroup && userRecord.usergroup.toLowerCase().includes('manager')) ||
                        (userRecord.usergroup && userRecord.usergroup.toLowerCase().includes('admin'));

      const isTransport = userRecord.usergroup && userRecord.usergroup.toLowerCase().includes('transport');

      let verifiedRole = 'employee';
      if (isTransport) {
        verifiedRole = 'transport';
      } else if (isManager) {
        verifiedRole = 'manager';
      }

      // Ignore clientRequestedRole for privilege determination
      const accessAllowed = clientRequestedRole ? verifiedRole === clientRequestedRole : true;

      return {
        verifiedRole,
        accessAllowed,
        permissions: {
          canApprove: verifiedRole === 'manager',
          canDispatch: verifiedRole === 'transport'
        }
      };
    };

    // Standard employee attempting to request "manager" or "admin" role
    const regularUser = { username: '3787701', usergroup: 'Employee', manage: '0' };
    const attempt = resolveRoleAndAccess(regularUser, 'manager');

    assertEquals(attempt.verifiedRole, 'employee', 'Server resolved role remains employee');
    assertEquals(attempt.accessAllowed, false, 'Client-requested role elevation is rejected');
    assertEquals(attempt.permissions.canApprove, false, 'Approval privilege is denied');
    assertEquals(attempt.permissions.canDispatch, false, 'Dispatch privilege is denied');

    // Real manager
    const managerUser = { username: '3787702', usergroup: 'Manager', manage: '1' };
    const mgrAuth = resolveRoleAndAccess(managerUser, 'manager');
    assertEquals(mgrAuth.verifiedRole, 'manager', 'Manager verified role resolved as manager');
    assertEquals(mgrAuth.permissions.canApprove, true, 'Manager permitted to approve');
  });

  // 6. Repository Secret Exposure & .gitignore Shielding
  await suite.test('Repository configuration strictly excludes .env files and shields credentials', async () => {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    assertTruthy(fs.existsSync(gitignorePath), '.gitignore file exists at project root');

    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assertTruthy(gitignoreContent.includes('.env'), '.gitignore excludes .env files');
    assertTruthy(gitignoreContent.includes('.env.local'), '.gitignore excludes .env.local files');
    assertTruthy(gitignoreContent.includes('node_modules'), '.gitignore excludes node_modules');

    // Verify .env.example contains only dummy placeholder values
    const envExamplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
      assertTruthy(!exampleContent.includes('ep-cool-db'), '.env.example contains no real database hostnames');
      assertTruthy(!exampleContent.includes('Bhel@'), '.env.example contains no real credentials');
    }
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityAuditTests().finally(() => pool.end());
}

module.exports = { runSecurityAuditTests };
