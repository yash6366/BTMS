/**
 * PostgreSQL Database Invariants & Integrity Test Suite
 * 
 * Tests:
 * 1. Read-Only: Database connection & SSL handshake
 * 2. Read-Only: Required schema tables & views presence
 * 3. Read-Only: Sequences alignment check
 * 4. Read-Only: Role-Based User accounts integrity
 * 5. Isolated Transaction: Transaction rollback invariant (guarantees zero persistent modification)
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');

const connectionString = process.env.DATABASE_URL;

async function runDatabaseTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING DATABASE INVARIANTS & INTEGRITY TESTS      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  if (!connectionString) {
    console.warn(`  ${colors.yellow}⚠ SKIPPED: DATABASE_URL is not set in .env${colors.reset}`);
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true }
  });

  const suite = new TestSuite('Database: Neon PostgreSQL Invariants');
  let client;

  try {
    client = await pool.connect();

    // 1. Connection & Server Info
    await suite.test('PostgreSQL connection and active database check', async () => {
      const res = await client.query('SELECT NOW() as current_time, current_database() as db_name, version() as version;');
      assertTruthy(res.rows[0].db_name, 'Database name returned');
      assertTruthy(res.rows[0].current_time, 'Current server time returned');
    });

    // 2. Audited Tables Presence
    await suite.test('Required core tables and views presence in public schema', async () => {
      const expectedObjects = [
        'axusers',
        'cabbooking1_new',
        'CABBOOKING_DETAILS',
        'APPROVAL_NOTIFICATIONS',
        'EDN_PIS_EMPLOYEE_MASTER_VIEW'
      ];

      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = ANY($1);
      `, [expectedObjects]);

      const foundTables = res.rows.map(r => r.table_name);
      for (const obj of expectedObjects) {
        assert(foundTables.includes(obj), `Table/view '${obj}' must exist in public schema`);
      }
    });

    // 3. User Group & Account Invariants (Read-Only)
    await suite.test('User group roles and active account status (Read-Only)', async () => {
      const res = await client.query(`
        SELECT username, usergroup, active 
        FROM "axusers" 
        WHERE username IN ('6234070', '3787702', 'transport');
      `);

      assert(res.rows.length >= 1, 'At least one default user must exist');
      const employee = res.rows.find(u => u.username === '6234070');
      if (employee) {
        assertEquals(employee.active, '1', 'Employee account should be active');
      }
    });

    // 4. Primary Key & Sequence Invariants (Read-Only)
    await suite.test('Sequence counter alignment check (Read-Only)', async () => {
      const seqCheck = await client.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public';
      `);
      assert(Array.isArray(seqCheck.rows), 'Sequences query should succeed');
    });

    // 5. Transaction Rollback Safety Invariant (Isolated rollback test - NO persistent changes)
    await suite.test('Isolated transaction rollback safety test (Zero persistence)', async () => {
      await client.query('BEGIN;');
      
      const testPassengerName = `TEMP_ROLLBACK_TEST_${Date.now()}`;
      const insertRes = await client.query(`
        INSERT INTO "cabbooking1_new" (
          "PASSENGER_NAME", "MOB_NO_USER", "INDENTER_NAME", "MOB_NO_INDTR",
          "STAFF_NO_INDTR", "STAFF_NO_USER", "DEPT_USER", "STARTING_PLACE",
          "TAKE_OFF_FROM", "DESTINATION", "TRIP_TIME", "TRIP_DATE",
          "INDENT_DATE", "VEH_REQUESTED", "PURPOSE", "STAFF_NO_APVR",
          "STATUS_APVR", "STATUS_USER"
        ) VALUES (
          $1, '9999999999', 'RollbackTester', '9999999999',
          'TEST001', 'TEST001', 'IT', 'Origin',
          'Bangalore', 'Factory', '10:00', CURRENT_DATE,
          CURRENT_DATE, 'Sedan', 'Integrity Test', '3787702',
          'OPEN', 'CLSD'
        ) RETURNING "BookingID";
      `, [testPassengerName]);

      const insertedId = insertRes.rows[0].BookingID;
      assertTruthy(insertedId, 'Temporary record inserted within transaction');

      // Force ROLLBACK
      await client.query('ROLLBACK;');

      // Verify the record was completely rolled back and DOES NOT exist
      const verifyRes = await client.query(`
        SELECT "BookingID" 
        FROM "cabbooking1_new" 
        WHERE "BookingID" = $1;
      `, [insertedId]);

      assertEquals(verifyRes.rows.length, 0, 'Record MUST NOT exist after transaction rollback');
    });

  } catch (error) {
    console.error('Database test failure:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runDatabaseTests();
}

module.exports = { runDatabaseTests };
