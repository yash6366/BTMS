/**
 * PostgreSQL Constraint, Trigger & Transaction Regression Test Suite
 * Validates database-level enforcement of Primary Keys, Unique Constraints,
 * NOT NULL constraints, Column Lengths, Datetime Types, and Transaction Savepoints.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runDatabaseConstraintsTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING DATABASE CONSTRAINT & REGRESSION TESTS    ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Database: PostgreSQL Constraint & Integrity Regression');

  // 1. Primary Key & Unique Constraint Enforcement (PostgreSQL 23505)
  await suite.test('Primary Key / Unique Constraint rejects duplicate records with code 23505', async () => {
    const client = await pool.connect();
    try {
      // Find an existing real username
      const existingUser = await client.query('SELECT username FROM "axusers" LIMIT 1');
      assertTruthy(existingUser.rows.length > 0, 'At least one user exists in axusers');
      const targetUser = existingUser.rows[0].username;

      await client.query('BEGIN');
      let caughtError = null;
      try {
        await client.query('INSERT INTO "axusers" (username, password) VALUES ($1, $2)', [targetUser, 'DuplicatePass123!']);
      } catch (err) {
        caughtError = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(caughtError !== null, 'Duplicate username insert was rejected by PostgreSQL');
      assertEquals(caughtError.code, '23505', 'PostgreSQL error code is 23505 (unique_violation)');
    } finally {
      client.release();
    }
  });

  // 2. NOT NULL Column Invariants (PostgreSQL 23502)
  await suite.test('NOT NULL constraints reject NULL values with code 23502', async () => {
    const client = await pool.connect();
    try {
      // Test 1: axusers.username NOT NULL
      await client.query('BEGIN');
      let userNullError = null;
      try {
        await client.query('INSERT INTO "axusers" (username, password) VALUES (NULL, $1)', ['SomePassword']);
      } catch (err) {
        userNullError = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(userNullError !== null, 'NULL username insert rejected');
      assertEquals(userNullError.code, '23502', 'axusers.username null rejection code is 23502 (not_null_violation)');

      // Test 2: CABBOOKING_DETAILS.SERIAL_NO NOT NULL
      await client.query('BEGIN');
      let serialNullError = null;
      try {
        await client.query('INSERT INTO "CABBOOKING_DETAILS" ("SERIAL_NO") VALUES (NULL)');
      } catch (err) {
        serialNullError = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(serialNullError !== null, 'NULL SERIAL_NO insert rejected');
      assertEquals(serialNullError.code, '23502', 'CABBOOKING_DETAILS.SERIAL_NO null rejection code is 23502');
    } finally {
      client.release();
    }
  });

  // 3. Column Type & Length Overflow Boundaries (PostgreSQL 22001)
  await suite.test('VARCHAR length boundaries enforce overflow rejection with code 22001', async () => {
    const client = await pool.connect();
    try {
      // Test STAFF_NO_USER VARCHAR(7) boundary
      // 7 chars: valid
      await client.query('BEGIN');
      let validInsert = null;
      try {
        validInsert = await client.query(
          'INSERT INTO "cabbooking1_new" ("STAFF_NO_USER", "PASSENGER_NAME") VALUES ($1, $2) RETURNING "BookingID"',
          ['1234567', 'Boundary Valid']
        );
      } finally {
        await client.query('ROLLBACK');
      }
      assertTruthy(validInsert !== null && validInsert.rows.length > 0, '7-character STAFF_NO accepted');

      // 8 chars (> 7): must throw 22001
      await client.query('BEGIN');
      let overflowError = null;
      try {
        await client.query(
          'INSERT INTO "cabbooking1_new" ("STAFF_NO_USER", "PASSENGER_NAME") VALUES ($1, $2)',
          ['12345678', 'Boundary Overflow']
        );
      } catch (err) {
        overflowError = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(overflowError !== null, '8-character STAFF_NO rejected');
      assertEquals(overflowError.code, '22001', 'Length overflow code is 22001 (string_data_right_truncation)');

      // Test TRIP_HR VARCHAR(2) boundary in CABBOOKING_DETAILS
      await client.query('BEGIN');
      let hrOverflow = null;
      try {
        await client.query(
          'INSERT INTO "CABBOOKING_DETAILS" ("SERIAL_NO", "TRIP_HR") VALUES ($1, $2)',
          ['TX_REG_01', '999'] // 3 chars into VARCHAR(2)
        );
      } catch (err) {
        hrOverflow = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(hrOverflow !== null, '3-character TRIP_HR rejected');
      assertEquals(hrOverflow.code, '22001', 'TRIP_HR overflow code is 22001');
    } finally {
      client.release();
    }
  });

  // 4. DateTime / Timestamp Format Boundary (PostgreSQL 22007)
  await suite.test('Timestamp columns reject invalid datetime strings with code 22007', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let dateError = null;
      try {
        await client.query(
          'INSERT INTO "cabbooking1_new" ("TRIP_DATE", "PASSENGER_NAME") VALUES ($1, $2)',
          ['INVALID_DATE_FORMAT_STRING_9999', 'Date Test']
        );
      } catch (err) {
        dateError = err;
      } finally {
        await client.query('ROLLBACK');
      }

      assertTruthy(dateError !== null, 'Invalid timestamp string rejected');
      assertEquals(dateError.code, '22007', 'Invalid datetime code is 22007 (invalid_datetime_format)');
    } finally {
      client.release();
    }
  });

  // 5. Transaction Atomicity & Savepoint Rollback Invariant (Zero Data Leakage)
  await suite.test('SAVEPOINT rollback recovers transaction and guarantees zero persistence', async () => {
    const client = await pool.connect();
    const testMarker = `TX_${Date.now() % 1000000}`; // 9 chars, fits in VARCHAR(11)
    try {
      await client.query('BEGIN');

      // 1. Insert valid staging record
      const insertRes = await client.query(
        'INSERT INTO "cabbooking1_new" ("SERIAL_NO", "PASSENGER_NAME") VALUES ($1, $2) RETURNING "BookingID"',
        [testMarker, 'Savepoint Passenger']
      );
      const tempBookingId = insertRes.rows[0].BookingID;
      assertTruthy(tempBookingId > 0, 'Staging record inserted in transaction');

      // 2. Create SAVEPOINT before negative test
      await client.query('SAVEPOINT regression_test_point');

      // 3. Intentional negative test (violating NOT NULL)
      let caughtErr = null;
      try {
        await client.query('INSERT INTO "axusers" (username) VALUES (NULL)');
      } catch (err) {
        caughtErr = err;
      }
      assertTruthy(caughtErr !== null, 'Savepoint error was triggered');

      // 4. Rollback to savepoint to restore transaction state
      await client.query('ROLLBACK TO SAVEPOINT regression_test_point');

      // 5. Verify transaction is healthy and queryable again
      const queryCheck = await client.query(
        'SELECT "SERIAL_NO" FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1',
        [testMarker]
      );
      assertEquals(queryCheck.rows.length, 1, 'Transaction recovered and can query staging record');

      // 6. Complete ROLLBACK
      await client.query('ROLLBACK');

      // 7. Verify zero persistence on pool
      const leakCheck = await pool.query(
        'SELECT "BookingID" FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1',
        [testMarker]
      );
      assertEquals(leakCheck.rows.length, 0, 'Database is 100% clean: zero records leaked after rollback');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // 6. Database Constraint & Trigger Catalog Discovery Verification
  await suite.test('Live database catalog matches certified schema invariants', async () => {
    const res = await pool.query(`
      SELECT 
        conname, 
        contype, 
        conrelid::regclass::text as table_name
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
    `);

    const pks = res.rows.filter(r => r.contype === 'p').map(r => `${r.table_name}:${r.conname}`);
    assertTruthy(pks.some(p => p.includes('axusers')), 'axusers Primary Key confirmed in catalog');
    assertTruthy(pks.some(p => p.includes('cabbooking1_new')), 'cabbooking1_new Primary Key confirmed in catalog');
    assertTruthy(pks.some(p => p.includes('CABBOOKING_DETAILS')), 'CABBOOKING_DETAILS Primary Key confirmed in catalog');
    assertTruthy(pks.some(p => p.includes('APPROVAL_NOTIFICATIONS')), 'APPROVAL_NOTIFICATIONS Primary Key confirmed in catalog');

    // Trigger check (only certified audit log immutability trigger should exist)
    const triggerRes = await pool.query(`
      SELECT tgname 
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    `);
    const unmanagedTriggers = triggerRes.rows.filter(r => r.tgname !== 'trg_audit_log_immutability');
    assertEquals(unmanagedTriggers.length, 0, 'Zero unmanaged triggers in public schema');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runDatabaseConstraintsTests().finally(() => pool.end());
}

module.exports = { runDatabaseConstraintsTests };
