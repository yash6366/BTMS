const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true }
});

async function testCrudFlows() {
  console.log('🧪 RUNNING COMPLETE BHEL BUSINESS CRUD FLOW TEST (NEON POSTGRESQL)');
  console.log('==================================================================\n');
  const client = await pool.connect();

  try {
    // 1. Employee Creates a Ride Booking
    console.log('1️⃣ Step 1: Employee Creates a Ride Booking...');
    const testPassenger = `Test Passenger ${Date.now()}`;
    const insertRes = await client.query(`
      INSERT INTO "cabbooking1_new" (
        "PASSENGER_NAME", "MOB_NO_USER", "INDENTER_NAME", "MOB_NO_INDTR",
        "STAFF_NO_INDTR", "STAFF_NO_USER", "DEPT_USER", "OTHER_DETAILS",
        "INTERNAL_NO", "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM",
        "DESTINATION", "TRIP_TIME", "TRIP_DATE", "INDENT_DATE",
        "VEH_REQUESTED", "DURATION_REQ", "PURPOSE", "STAFF_NO_APVR",
        "STATUS_APVR", "STATUS_USER"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING "BookingID" AS "InsertedID";
    `, [
      testPassenger, '9876543210', 'Yashwanth M', '9876543210',
      '6234070', '6234070', 'IT', 'Neon Migration Test Ride',
      'INT001', 'BHEL Township', '12627', 'Bengaluru',
      'BHEL Factory', '09:00', new Date(), new Date(),
      'Sedan', '2 Hours', 'Official Meeting', '3787702',
      'OPEN', 'CLSD'
    ]);

    const bookingId = insertRes.rows[0].InsertedID;
    const serialNo = `TAXI${bookingId}`;
    console.log(`   ✅ Booking created with BookingID: ${bookingId}`);

    // Update Serial Number
    await client.query(`
      UPDATE "cabbooking1_new"
      SET "SERIAL_NO" = $1
      WHERE "BookingID" = $2;
    `, [serialNo, bookingId]);
    console.log(`   ✅ SERIAL_NO assigned: ${serialNo}`);

    // 2. Notification created for Manager
    console.log('\n2️⃣ Step 2: Creating Approval Notification for Manager (3787702)...');
    const notifRes = await client.query(`
      INSERT INTO "APPROVAL_NOTIFICATIONS" (
        "SERIAL_NO", "APPROVER_STAFF_NO", "REQUESTER_NAME", "PASSENGER_NAME",
        "TRIP_DATE", "PURPOSE", "NOTIFICATION_DATE", "STATUS"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING "ID";
    `, [
      serialNo, '3787702', 'Yashwanth M', testPassenger,
      new Date(), 'Official Meeting', new Date(), 'PENDING'
    ]);
    const notifId = notifRes.rows[0].ID;
    console.log(`   ✅ Notification ID: ${notifId} created with status PENDING`);

    // 3. Manager Approves the Ride
    console.log('\n3️⃣ Step 3: Manager Approves Ride...');
    await client.query(`
      UPDATE "cabbooking1_new"
      SET "STATUS_APVR" = 'APVD', "PASS_DATE_APVR" = NOW(), "REMARKS_APVR" = 'Approved via Test'
      WHERE "SERIAL_NO" = $1;
    `, [serialNo]);

    await client.query(`
      UPDATE "APPROVAL_NOTIFICATIONS"
      SET "STATUS" = 'READ'
      WHERE "SERIAL_NO" = $1;
    `, [serialNo]);
    console.log(`   ✅ Booking ${serialNo} marked APVD and notification marked READ`);

    // 4. Sync to CABBOOKING_DETAILS for Transport
    console.log('\n4️⃣ Step 4: Synchronizing to CABBOOKING_DETAILS for Transport Pool...');
    const shortSerial = serialNo.substring(Math.max(0, serialNo.length - 4)).padStart(4, '0');
    await client.query(`
      INSERT INTO "CABBOOKING_DETAILS" (
        "SERIAL_NO", "STAFF_NO_INDTR", "STAFF_NO_USER", "PASSENGER_NAME",
        "MOB_NO_INDTR", "MOB_NO_USER", "STARTING_PLACE", "DESTINATION",
        "TRIP_TIME", "TRIP_DATE", "INDENT_DATE", "VEH_REQUESTED",
        "PURPOSE", "STAFF_NO_APVR", "STATUS_APVR", "INTERNAL_NO", "STATUS_TRANS"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PEND'
      ) ON CONFLICT ("SERIAL_NO") DO NOTHING;
    `, [
      shortSerial, '6234070', '6234070', testPassenger,
      '9876543210', '9876543210', 'BHEL Township', 'BHEL Factory',
      '09:00', new Date(), new Date(), 'Sedan',
      'Official Meeting', '3787702', 'APVD', serialNo
    ]);
    console.log(`   ✅ Synced into CABBOOKING_DETAILS with transport ID: ${shortSerial}`);

    // 5. Transport Pool Allots Vehicle & Driver
    console.log('\n5️⃣ Step 5: Transport Passes Booking and Allots Vehicle/Driver...');
    await client.query(`
      UPDATE "CABBOOKING_DETAILS"
      SET 
        "STATUS_TRANS" = 'PASS',
        "PASS_DATE_APVR" = NOW(),
        "VEH_ALLOTTED" = 'Innova Crysta',
        "VEHICLE_NO" = 'KA-01-AB-1234',
        "DRIVER_NAME" = 'Ramesh Kumar',
        "DRIVER_MOB_NO" = '9876500000',
        "REMARKS_TRANS" = 'Vehicle dispatched on schedule'
      WHERE "SERIAL_NO" = $1;
    `, [shortSerial]);
    console.log(`   ✅ Transport status updated to PASS with Driver: Ramesh Kumar (KA-01-AB-1234)`);

    // 6. User Views Booking in "My Rides"
    console.log('\n6️⃣ Step 6: Querying User My Rides View...');
    const userRidesRes = await client.query(`
      SELECT "SERIAL_NO", "PASSENGER_NAME", "STATUS_APVR", "STATUS_USER"
      FROM "cabbooking1_new"
      WHERE "STAFF_NO_USER" = '6234070' AND "SERIAL_NO" = $1;
    `, [serialNo]);

    console.log('   ✅ Query result for User:', userRidesRes.rows[0]);

    // Clean up test records
    console.log('\n🧹 Cleaning up test records...');
    await client.query(`DELETE FROM "CABBOOKING_DETAILS" WHERE "SERIAL_NO" = $1`, [shortSerial]);
    await client.query(`DELETE FROM "APPROVAL_NOTIFICATIONS" WHERE "ID" = $1`, [notifId]);
    await client.query(`DELETE FROM "cabbooking1_new" WHERE "BookingID" = $1`, [bookingId]);
    console.log('   ✅ Test records cleaned up.');

    console.log('\n🎉 ALL 6 STEPS OF THE BHEL BUSINESS FLOW PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ CRUD Flow Test Failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testCrudFlows();
