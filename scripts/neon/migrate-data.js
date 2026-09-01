const { Pool } = require('pg');
const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pgConnectionString = process.env.DATABASE_URL;

if (!pgConnectionString) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const pgPool = new Pool({
  connectionString: pgConnectionString,
  ssl: pgConnectionString.includes('localhost') ? false : { rejectUnauthorized: true }
});

const mssqlConfig = {
  server: process.env.MSSQL_SERVER || process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  database: process.env.MSSQL_DATABASE || process.env.DB_DATABASE,
  user: process.env.MSSQL_USER || process.env.DB_USER,
  password: process.env.MSSQL_PASSWORD || process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT !== 'false',
    trustServerCertificate: true,
  }
};

async function migrateData() {
  console.log('🚀 Starting Data Migration: MSSQL -> Neon PostgreSQL\n');
  let mssqlPool;
  let pgClient;

  try {
    console.log('🔌 Connecting to MSSQL...');
    mssqlPool = await sql.connect(mssqlConfig);
    console.log('✅ MSSQL Connected.');

    console.log('🔌 Connecting to Neon PostgreSQL...');
    pgClient = await pgPool.connect();
    console.log('✅ Neon PostgreSQL Connected.\n');

    // 1. Migrate axusers
    console.log('📦 Migrating axusers...');
    const usersRes = await mssqlPool.request().query('SELECT * FROM axusers');
    let userCount = 0;
    for (const u of usersRes.recordset) {
      await pgClient.query(`
        INSERT INTO "axusers" (
          "username", "password", "pwd", "hashed_password", "usergroup", 
          "groupno", "build", "manage", "tools", "email", "pageaccess", 
          "active", "Reportingto"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT ("username") DO UPDATE SET
          "password" = EXCLUDED."password",
          "pwd" = EXCLUDED."pwd",
          "hashed_password" = EXCLUDED."hashed_password",
          "usergroup" = EXCLUDED."usergroup",
          "manage" = EXCLUDED."manage",
          "active" = EXCLUDED."active";
      `, [
        u.username, u.password, u.pwd, u.hashed_password, u.usergroup,
        u.groupno, u.build, u.manage, u.tools, u.email, u.pageaccess,
        u.active, u.Reportingto
      ]);
      userCount++;
    }
    console.log(`✅ Migrated ${userCount} users.\n`);

    // 2. Migrate cabbooking1_new
    console.log('📦 Migrating cabbooking1_new...');
    const bookingsRes = await mssqlPool.request().query('SELECT * FROM cabbooking1_new');
    let bookingCount = 0;
    for (const b of bookingsRes.recordset) {
      await pgClient.query(`
        INSERT INTO "cabbooking1_new" (
          "BookingID", "PASSENGER_NAME", "MOB_NO_USER", "INDENTER_NAME", "MOB_NO_INDTR",
          "STAFF_NO", "STAFF_NO_INDTR", "STAFF_NO_USER", "DEPT_USER", "OTHER_DETAILS",
          "INTERNAL_NO", "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM", "DESTINATION",
          "TRIP_TIME", "TRIP_DATE", "INDENT_DATE", "VEH_REQUESTED", "DURATION_REQ",
          "PURPOSE", "STAFF_NO_APVR", "STATUS_APVR", "STATUS_USER", "SERIAL_NO",
          "PASS_DATE_APVR", "VEH_ALLOTTED", "VEHICLE_NO", "DRIVER_NAME", "DRIVER_MOB_NO",
          "REMARKS_USER", "REMARKS_APVR", "REMARKS_TRANS", "STATUS_TRANS", "COMPANY_NAME"
        ) OVERRIDING SYSTEM VALUE VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35
        ) ON CONFLICT ("BookingID") DO NOTHING;
      `, [
        b.BookingID, b.PASSENGER_NAME, b.MOB_NO_USER, b.INDENTER_NAME, b.MOB_NO_INDTR,
        b.STAFF_NO, b.STAFF_NO_INDTR, b.STAFF_NO_USER, b.DEPT_USER, b.OTHER_DETAILS,
        b.INTERNAL_NO, b.STARTING_PLACE, b.FLIGHT_TRAIN_NO, b.TAKE_OFF_FROM, b.DESTINATION,
        b.TRIP_TIME, b.TRIP_DATE, b.INDENT_DATE, b.VEH_REQUESTED, b.DURATION_REQ,
        b.PURPOSE, b.STAFF_NO_APVR, b.STATUS_APVR, b.STATUS_USER, b.SERIAL_NO,
        b.PASS_DATE_APVR, b.VEH_ALLOTTED, b.VEHICLE_NO, b.DRIVER_NAME, b.DRIVER_MOB_NO,
        b.REMARKS_USER, b.REMARKS_APVR, b.REMARKS_TRANS, b.STATUS_TRANS, b.COMPANY_NAME
      ]);
      bookingCount++;
    }
    console.log(`✅ Migrated ${bookingCount} bookings.\n`);

    // 3. Migrate CABBOOKING_DETAILS
    console.log('📦 Migrating CABBOOKING_DETAILS...');
    try {
      const detailsRes = await mssqlPool.request().query('SELECT * FROM CABBOOKING_DETAILS');
      let detailsCount = 0;
      for (const d of detailsRes.recordset) {
        if (!d.SERIAL_NO) continue;
        await pgClient.query(`
          INSERT INTO "CABBOOKING_DETAILS" (
            "SERIAL_NO", "STAFF_NO_INDTR", "STAFF_NO_USER", "PASSENGER_NAME", "MOB_NO_INDTR", "MOB_NO_USER",
            "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM", "DESTINATION", "TRIP_HR", "TRIP_MIN",
            "TRIP_TIME", "TRIP_DATE", "INDENT_TIME", "INDENT_DATE", "VEH_REQUESTED", "DURATION_REQ",
            "PURPOSE", "REMARKS_USER", "STAFF_NO_APVR", "STATUS_USER", "PASS_DATE_APVR", "REMARKS_APVR",
            "STATUS_APVR", "COMPANY_NAME", "OTHER_DETAILS", "DEPT_USER", "START_PLACE_TYPE", "DEPT_INDT",
            "INDENTER_NAME", "INTERNAL_NO", "STATUS_TRANS", "VEH_ALLOTTED", "VEHICLE_NO", "DRIVER_NAME",
            "DRIVER_MOB_NO", "REMARKS_TRANS"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38
          ) ON CONFLICT ("SERIAL_NO") DO NOTHING;
        `, [
          d.SERIAL_NO, d.STAFF_NO_INDTR, d.STAFF_NO_USER, d.PASSENGER_NAME, d.MOB_NO_INDTR, d.MOB_NO_USER,
          d.STARTING_PLACE, d.FLIGHT_TRAIN_NO, d.TAKE_OFF_FROM, d.DESTINATION, d.TRIP_HR, d.TRIP_MIN,
          d.TRIP_TIME, d.TRIP_DATE, d.INDENT_TIME, d.INDENT_DATE, d.VEH_REQUESTED, d.DURATION_REQ,
          d.PURPOSE, d.REMARKS_USER, d.STAFF_NO_APVR, d.STATUS_USER, d.PASS_DATE_APVR, d.REMARKS_APVR,
          d.STATUS_APVR, d.COMPANY_NAME, d.OTHER_DETAILS, d.DEPT_USER, d.START_PLACE_TYPE, d.DEPT_INDT,
          d.INDENTER_NAME, d.INTERNAL_NO, d.STATUS_TRANS, d.VEH_ALLOTTED, d.VEHICLE_NO, d.DRIVER_NAME,
          d.DRIVER_MOB_NO, d.REMARKS_TRANS
        ]);
        detailsCount++;
      }
      console.log(`✅ Migrated ${detailsCount} transport detail records.\n`);
    } catch (err) {
      console.log(`ℹ️ CABBOOKING_DETAILS skipped or empty: ${err.message}\n`);
    }

    // 4. Migrate APPROVAL_NOTIFICATIONS
    console.log('📦 Migrating APPROVAL_NOTIFICATIONS...');
    try {
      const notifRes = await mssqlPool.request().query('SELECT * FROM APPROVAL_NOTIFICATIONS');
      let notifCount = 0;
      for (const n of notifRes.recordset) {
        await pgClient.query(`
          INSERT INTO "APPROVAL_NOTIFICATIONS" (
            "ID", "SERIAL_NO", "APPROVER_STAFF_NO", "REQUESTER_NAME", "PASSENGER_NAME",
            "TRIP_DATE", "PURPOSE", "NOTIFICATION_DATE", "STATUS"
          ) OVERRIDING SYSTEM VALUE VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) ON CONFLICT ("ID") DO NOTHING;
        `, [
          n.ID, n.SERIAL_NO, n.APPROVER_STAFF_NO, n.REQUESTER_NAME, n.PASSENGER_NAME,
          n.TRIP_DATE, n.PURPOSE, n.NOTIFICATION_DATE, n.STATUS
        ]);
        notifCount++;
      }
      console.log(`✅ Migrated ${notifCount} notifications.\n`);
    } catch (err) {
      console.log(`ℹ️ APPROVAL_NOTIFICATIONS skipped or empty: ${err.message}\n`);
    }

    // 5. Migrate EDN_PIS_EMPLOYEE_MASTER_VIEW
    console.log('📦 Migrating EDN_PIS_EMPLOYEE_MASTER_VIEW...');
    try {
      const empRes = await mssqlPool.request().query('SELECT * FROM EDN_PIS_EMPLOYEE_MASTER_VIEW');
      let empCount = 0;
      for (const e of empRes.recordset) {
        if (!e.EMP_ID) continue;
        await pgClient.query(`
          INSERT INTO "EDN_PIS_EMPLOYEE_MASTER_VIEW" (
            "EMP_ID", "EMP_FNAME", "EMP_MNAME", "EMP_LNAME", "EMP_DESIGNATION", "EMP_EMAIL_ID", "DEPT"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ("EMP_ID") DO UPDATE SET
            "EMP_FNAME" = EXCLUDED."EMP_FNAME",
            "EMP_MNAME" = EXCLUDED."EMP_MNAME",
            "EMP_LNAME" = EXCLUDED."EMP_LNAME",
            "EMP_DESIGNATION" = EXCLUDED."EMP_DESIGNATION",
            "EMP_EMAIL_ID" = EXCLUDED."EMP_EMAIL_ID",
            "DEPT" = EXCLUDED."DEPT";
        `, [
          e.EMP_ID, e.EMP_FNAME, e.EMP_MNAME, e.EMP_LNAME, e.EMP_DESIGNATION, e.EMP_EMAIL_ID, e.DEPT || e.DEPT_USER
        ]);
        empCount++;
      }
      console.log(`✅ Migrated ${empCount} employee master records.\n`);
    } catch (err) {
      console.log(`ℹ️ EDN_PIS_EMPLOYEE_MASTER_VIEW skipped or seeded: ${err.message}\n`);
    }

    // Synchronize Sequences
    console.log('🔄 Synchronizing Identity Sequences on Neon...');
    const bookingSeqRes = await pgClient.query(`SELECT pg_get_serial_sequence('"cabbooking1_new"', 'BookingID') as seq_name`);
    const bookingSeq = bookingSeqRes.rows[0]?.seq_name;
    const maxBookingRes = await pgClient.query(`SELECT COALESCE(MAX("BookingID"), 0) as max_id FROM "cabbooking1_new"`);
    const maxBookingId = parseInt(maxBookingRes.rows[0].max_id, 10);
    if (bookingSeq) {
      await pgClient.query(`SELECT setval($1, $2, $3)`, [bookingSeq, Math.max(maxBookingId, 1), maxBookingId > 0]);
      console.log(`  cabbooking1_new sequence synced to ${maxBookingId}`);
    }

    const notifSeqRes = await pgClient.query(`SELECT pg_get_serial_sequence('"APPROVAL_NOTIFICATIONS"', 'ID') as seq_name`);
    const notifSeq = notifSeqRes.rows[0]?.seq_name;
    const maxNotifRes = await pgClient.query(`SELECT COALESCE(MAX("ID"), 0) as max_id FROM "APPROVAL_NOTIFICATIONS"`);
    const maxNotifId = parseInt(maxNotifRes.rows[0].max_id, 10);
    if (notifSeq) {
      await pgClient.query(`SELECT setval($1, $2, $3)`, [notifSeq, Math.max(maxNotifId, 1), maxNotifId > 0]);
      console.log(`  APPROVAL_NOTIFICATIONS sequence synced to ${maxNotifId}`);
    }

    console.log('\n🎉 Data Migration and Sequence Sync Finished Successfully!');
  } catch (error) {
    console.error('❌ Data migration error:', error.message);
    process.exit(1);
  } finally {
    if (mssqlPool) await mssqlPool.close();
    if (pgClient) pgClient.release();
    await pgPool.end();
  }
}

migrateData();
