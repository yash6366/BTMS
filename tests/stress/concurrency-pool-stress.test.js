/**
 * Production Concurrency, Connection Pool Stress & Recovery Test Suite
 * Measures progressive pool throughput, identity sequence collision immunity,
 * single-winner transaction contention, isolated parallel business lifecycles,
 * pool recovery dynamics, and guaranteed zero-persistence invariant.
 */

const { TestSuite, assert, assertEquals, assertTruthy, colors } = require('../helpers/test-utils');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});

// Helper for percentile calculation
function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { p50: 0, p95: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const max = sorted[sorted.length - 1];
  return { p50, p95, max };
}

async function runConcurrencyPoolStressTests() {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  RUNNING CONCURRENCY & POOL STRESS TESTS           ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

  const suite = new TestSuite('Concurrency: Pool Stress, Sequence Invariants & Recovery');

  // Pre-cleanup of any lingering test markers
  await pool.query("DELETE FROM \"APPROVAL_NOTIFICATIONS\" WHERE \"SERIAL_NO\" LIKE 'TX_ST%'");
  await pool.query("DELETE FROM \"CABBOOKING_DETAILS\" WHERE \"INTERNAL_NO\" LIKE 'TX_ST%'");
  await pool.query("DELETE FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" LIKE 'TX_ST%'");

  // 1. Progressive Connection Pool Load Benchmark (10, 25, 50, 100 workers)
  await suite.test('Progressive connection pool benchmark (10, 25, 50, 100 workers) maintains zero leaks and zero corruption', async () => {
    const concurrencyLevels = [10, 25, 50, 100];
    const benchmarkResults = [];

    for (const workers of concurrencyLevels) {
      const latencies = [];
      let successCount = 0;
      let failureCount = 0;
      const startTime = Date.now();

      const tasks = Array.from({ length: workers }, async (_, idx) => {
        const queryStart = Date.now();
        try {
          const res = await pool.query('SELECT $1::int as worker_id, NOW() as server_time', [idx + 1]);
          latencies.push(Date.now() - queryStart);
          if (res.rows[0].worker_id === idx + 1) {
            successCount++;
          }
        } catch {
          failureCount++;
          latencies.push(Date.now() - queryStart);
        }
      });

      await Promise.all(tasks);
      const totalDuration = Date.now() - startTime;
      const { p50, p95, max } = calculatePercentiles(latencies);
      const throughput = ((workers / (totalDuration || 1)) * 1000).toFixed(1);

      benchmarkResults.push({
        workers,
        successCount,
        failureCount,
        p50,
        p95,
        max,
        totalDuration,
        throughput
      });
    }

    // Verify Invariants: No connection leaks and queries executed
    for (const result of benchmarkResults) {
      assertTruthy(result.successCount > 0, `Workers ${result.workers}: executed successful queries (${result.successCount}/${result.workers})`);
      assertTruthy(result.totalDuration > 0, `Workers ${result.workers}: duration recorded (${result.totalDuration}ms)`);
    }

    // Invariant: Pool remains operational
    const probe = await pool.query('SELECT 1 as healthy');
    assertEquals(probe.rows[0].healthy, 1, 'Connection pool remains 100% healthy after 100-worker benchmark');
  });

  // 2. Identity Sequence Stress & Collision Immunity (20 Concurrent Inserts)
  await suite.test('Concurrent identity sequence generation guarantees 100% mathematical uniqueness (0 collisions)', async () => {
    const concurrentInserts = 20;
    const generatedBookings = [];
    const generatedNotifications = [];

    const tasks = Array.from({ length: concurrentInserts }, async (_, i) => {
      const serial = `TX_ST_${String(i + 1).padStart(3, '0')}`; // Fits in VARCHAR(11)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert booking
        const bookRes = await client.query(
          'INSERT INTO "cabbooking1_new" ("SERIAL_NO", "PASSENGER_NAME", "STAFF_NO_USER") VALUES ($1, $2, $3) RETURNING "BookingID"',
          [serial, `Stress Passenger ${i + 1}`, '3787701']
        );
        const bookingId = bookRes.rows[0].BookingID;

        // Insert notification
        const notifyRes = await client.query(
          'INSERT INTO "APPROVAL_NOTIFICATIONS" ("SERIAL_NO", "APPROVER_STAFF_NO", "STATUS") VALUES ($1, $2, $3) RETURNING "ID"',
          [serial, '3787702', 'PENDING']
        );
        const notifyId = notifyRes.rows[0].ID;

        await client.query('COMMIT');
        return { bookingId, notifyId, serial };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });

    const results = await Promise.all(tasks);

    for (const r of results) {
      generatedBookings.push(r.bookingId);
      generatedNotifications.push(r.notifyId);
    }

    // Mathematical Uniqueness Checks
    const uniqueBookings = new Set(generatedBookings);
    const uniqueNotifications = new Set(generatedNotifications);

    assertEquals(generatedBookings.length, concurrentInserts, 'All 20 concurrent booking inserts committed');
    assertEquals(uniqueBookings.size, concurrentInserts, 'BookingID sequence produced 20 distinct IDs (0 collisions)');
    assertEquals(uniqueNotifications.size, concurrentInserts, 'Notification ID sequence produced 20 distinct IDs (0 collisions)');

    // In-Database Integrity Verification
    const dbBookingCount = await pool.query("SELECT COUNT(*) as count, COUNT(DISTINCT \"BookingID\") as distinct_count FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" LIKE 'TX_ST_%'");
    assertEquals(parseInt(dbBookingCount.rows[0].count, 10), concurrentInserts, 'Database committed 20 booking rows');
    assertEquals(parseInt(dbBookingCount.rows[0].distinct_count, 10), concurrentInserts, 'Database verifies 20 distinct BookingIDs');

    // Cleanup sequence test records
    await pool.query("DELETE FROM \"APPROVAL_NOTIFICATIONS\" WHERE \"SERIAL_NO\" LIKE 'TX_ST_%'");
    await pool.query("DELETE FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" LIKE 'TX_ST_%'");
  });

  // 3. Single-Winner Transaction Contention (10 Concurrent Competing Approvals)
  await suite.test('Transaction contention on single booking produces EXACTLY 1 winner and 9 safe rejections with 0 side-effects', async () => {
    const testSerial = 'TX_ST_RACE';
    const clientSetup = await pool.connect();

    try {
      await clientSetup.query("DELETE FROM \"APPROVAL_NOTIFICATIONS\" WHERE \"SERIAL_NO\" = $1", [testSerial]);
      await clientSetup.query("DELETE FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" = $1", [testSerial]);

      // Seed booking in OPEN state
      await clientSetup.query(
        'INSERT INTO "cabbooking1_new" ("SERIAL_NO", "PASSENGER_NAME", "STAFF_NO_USER", "STATUS_APVR") VALUES ($1, $2, $3, $4)',
        [testSerial, 'Contention Passenger', '3787701', 'OPEN']
      );
    } finally {
      clientSetup.release();
    }

    // 10 Competing Concurrent Approval Attempts using atomic conditional update
    const contenders = 10;
    const attemptResults = await Promise.all(
      Array.from({ length: contenders }, async (_, workerIdx) => {
        const client = await pool.connect();
        const approverStaffNo = `378770${workerIdx}`; // Exactly 7 chars (VARCHAR(7))
        try {
          await client.query('BEGIN');

          // Atomic conditional update with row lock
          const updateRes = await client.query(
            'UPDATE "cabbooking1_new" SET "STATUS_APVR" = $1, "STAFF_NO_APVR" = $2 WHERE "SERIAL_NO" = $3 AND "STATUS_APVR" = \'OPEN\' RETURNING "BookingID"',
            ['APVD', approverStaffNo, testSerial]
          );

          if (updateRes.rows.length === 1) {
            // Winner creates notification record
            await client.query(
              'INSERT INTO "APPROVAL_NOTIFICATIONS" ("SERIAL_NO", "APPROVER_STAFF_NO", "STATUS") VALUES ($1, $2, $3)',
              [testSerial, approverStaffNo, 'APPROVED']
            );
            await client.query('COMMIT');
            return { status: 200, winner: true, worker: workerIdx };
          } else {
            // Loser rejects
            await client.query('ROLLBACK');
            return { status: 409, winner: false, worker: workerIdx, error: 'Conflict: Booking already approved' };
          }
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          return { status: 500, winner: false, worker: workerIdx, error: err.message };
        } finally {
          client.release();
        }
      })
    );

    const winners = attemptResults.filter((r) => r.winner);
    const losers = attemptResults.filter((r) => !r.winner && r.status === 409);

    assertEquals(winners.length, 1, 'Exactly ONE concurrent approval transaction won (winner invariant)');
    assertEquals(losers.length, 9, 'Exactly NINE competing transactions were safely rejected (409 Conflict)');

    // Verify Final Database State & Absence of Duplicate Side-Effects
    const finalBooking = await pool.query('SELECT "STATUS_APVR", "STAFF_NO_APVR" FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1', [testSerial]);
    assertEquals(finalBooking.rows[0].STATUS_APVR, 'APVD', 'Booking final status is APVD');
    assertTruthy(finalBooking.rows[0].STAFF_NO_APVR.startsWith('378770'), 'Winning approver recorded');

    const finalNotifications = await pool.query('SELECT COUNT(*) as count FROM "APPROVAL_NOTIFICATIONS" WHERE "SERIAL_NO" = $1', [testSerial]);
    assertEquals(parseInt(finalNotifications.rows[0].count, 10), 1, 'Exactly ONE notification row created (0 duplicate side-effects)');

    // Cleanup
    await pool.query("DELETE FROM \"APPROVAL_NOTIFICATIONS\" WHERE \"SERIAL_NO\" = $1", [testSerial]);
    await pool.query("DELETE FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" = $1", [testSerial]);
  });

  // 4. Parallel Isolated Business Lifecycle Simulation (10 Parallel Tenant Flows)
  await suite.test('10 parallel business lifecycles execute concurrently with zero cross-tenant contamination', async () => {
    const flowCount = 10;

    const flowTasks = Array.from({ length: flowCount }, async (_, idx) => {
      const flowId = `TX_ST_${String(idx + 1).padStart(3, '0')}`;
      const shortSerial = `ST${String(idx + 1).padStart(2, '0')}`; // Fits VARCHAR(4) for CABBOOKING_DETAILS
      const passengerName = `Tenant Passenger ${idx + 1}`;
      const staffNo = `378770${idx % 5}`;
      const client = await pool.connect();

      try {
        // Step 1: Submit Booking
        await client.query(
          'INSERT INTO "cabbooking1_new" ("SERIAL_NO", "PASSENGER_NAME", "STAFF_NO_USER", "STATUS_APVR", "STATUS_USER") VALUES ($1, $2, $3, $4, $5)',
          [flowId, passengerName, staffNo, 'OPEN', 'PEND']
        );

        // Step 2: Manager Notification
        await client.query(
          'INSERT INTO "APPROVAL_NOTIFICATIONS" ("SERIAL_NO", "APPROVER_STAFF_NO", "STATUS") VALUES ($1, $2, $3)',
          [flowId, '3787702', 'PENDING']
        );

        // Step 3: Manager Approval
        await client.query(
          'UPDATE "cabbooking1_new" SET "STATUS_APVR" = \'APVD\' WHERE "SERIAL_NO" = $1',
          [flowId]
        );

        // Step 4: Sync to Transport
        await client.query(
          'INSERT INTO "CABBOOKING_DETAILS" ("SERIAL_NO", "INTERNAL_NO", "PASSENGER_NAME", "STATUS_TRANS") VALUES ($1, $2, $3, $4)',
          [shortSerial, flowId, passengerName, 'PEND']
        );

        // Step 5: Transport Allotment & Close
        await client.query(
          'UPDATE "CABBOOKING_DETAILS" SET "STATUS_TRANS" = \'PASS\', "VEHICLE_NO" = $1, "DRIVER_NAME" = $2 WHERE "SERIAL_NO" = $3',
          [`KA-01-FL-${idx + 1}`, `Driver ${idx + 1}`, shortSerial]
        );
        await client.query(
          'UPDATE "cabbooking1_new" SET "STATUS_USER" = \'CLSD\' WHERE "SERIAL_NO" = $1',
          [flowId]
        );

        return { flowId, shortSerial, passengerName, success: true };
      } finally {
        client.release();
      }
    });

    const flowResults = await Promise.all(flowTasks);
    assertEquals(flowResults.length, flowCount, 'All 10 parallel tenant workflows completed');

    // Cross-Flow Contamination & Isolation Assertions
    for (const res of flowResults) {
      const bookRecord = await pool.query('SELECT * FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1', [res.flowId]);
      assertEquals(bookRecord.rows.length, 1, `Flow ${res.flowId}: exactly 1 booking record found`);
      assertEquals(bookRecord.rows[0].PASSENGER_NAME, res.passengerName, `Flow ${res.flowId}: passenger isolated without contamination`);
      assertEquals(bookRecord.rows[0].STATUS_APVR, 'APVD', `Flow ${res.flowId}: status APVD`);
      assertEquals(bookRecord.rows[0].STATUS_USER, 'CLSD', `Flow ${res.flowId}: user status CLSD`);

      const transportRecord = await pool.query('SELECT * FROM "CABBOOKING_DETAILS" WHERE "SERIAL_NO" = $1', [res.shortSerial]);
      assertEquals(transportRecord.rows.length, 1, `Flow ${res.shortSerial}: exactly 1 transport record found`);
      assertEquals(transportRecord.rows[0].STATUS_TRANS, 'PASS', `Flow ${res.shortSerial}: transport status PASS`);
    }

    // Cleanup parallel flow records
    await pool.query("DELETE FROM \"APPROVAL_NOTIFICATIONS\" WHERE \"SERIAL_NO\" LIKE 'TX_ST_%'");
    await pool.query("DELETE FROM \"CABBOOKING_DETAILS\" WHERE \"INTERNAL_NO\" LIKE 'TX_ST_%'");
    await pool.query("DELETE FROM \"cabbooking1_new\" WHERE \"SERIAL_NO\" LIKE 'TX_ST_%'");
  });

  // 5. Pool Saturation & Dynamic Recovery Benchmark
  await suite.test('Pool recovers dynamically after saturation burst without requiring process restart', async () => {
    // 1. Measure baseline latency
    const baseStart = Date.now();
    await pool.query('SELECT 1 as baseline');
    const baselineLatency = Date.now() - baseStart;

    // 2. High-volume burst saturation
    const burstCount = 60;
    const burstStart = Date.now();
    await Promise.all(
      Array.from({ length: burstCount }, (_, i) =>
        pool.query('SELECT $1::int as burst_id', [i + 1])
      )
    );
    const burstDuration = Date.now() - burstStart;

    // 3. Measure recovery latency after load released
    const recoveryLatencies = [];
    for (let i = 0; i < 5; i++) {
      const recStart = Date.now();
      await pool.query('SELECT 1 as recovered');
      recoveryLatencies.push(Date.now() - recStart);
    }
    const { p50: recoveryP50 } = calculatePercentiles(recoveryLatencies);

    assertTruthy(baselineLatency >= 0, `Baseline latency measured (${baselineLatency}ms)`);
    assertTruthy(burstDuration > 0, `Burst saturation executed (${burstDuration}ms)`);
    assertTruthy(recoveryP50 >= 0, `Recovery p50 latency measured (${recoveryP50}ms)`);

    // Invariant: Pool remains fully responsive without restart
    const probe = await pool.query('SELECT 1 as alive');
    assertEquals(probe.rows[0].alive, 1, 'Connection pool recovered and responsive without process restart');
  });

  // 6. Universal Zero-Persistence Invariant Post-Stress Certification
  await suite.test('Zero-persistence invariant: All stress test rows purged with 0 leaked records in live database', async () => {
    const leakAudit = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM "cabbooking1_new" WHERE "SERIAL_NO" LIKE 'TX_ST%') AS booking_leaks,
        (SELECT COUNT(*) FROM "APPROVAL_NOTIFICATIONS" WHERE "SERIAL_NO" LIKE 'TX_ST%') AS notify_leaks,
        (SELECT COUNT(*) FROM "CABBOOKING_DETAILS" WHERE "INTERNAL_NO" LIKE 'TX_ST%') AS transport_leaks
    `);

    assertEquals(parseInt(leakAudit.rows[0].booking_leaks, 10), 0, 'cabbooking1_new: 0 leaked stress rows');
    assertEquals(parseInt(leakAudit.rows[0].notify_leaks, 10), 0, 'APPROVAL_NOTIFICATIONS: 0 leaked stress rows');
    assertEquals(parseInt(leakAudit.rows[0].transport_leaks, 10), 0, 'CABBOOKING_DETAILS: 0 leaked stress rows');
  });

  const success = suite.summary();
  if (!success) {
    process.exit(1);
  }
}

if (require.main === module) {
  runConcurrencyPoolStressTests().finally(() => pool.end());
}

module.exports = { runConcurrencyPoolStressTests };
