const { Pool } = require('pg');
const path = require('path');
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

async function verifyAndSyncSequences() {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking and synchronizing PostgreSQL identity sequences...\n');

    // 1. cabbooking1_new.BookingID
    const bookingSeqRes = await client.query(`
      SELECT pg_get_serial_sequence('"cabbooking1_new"', 'BookingID') as seq_name
    `);
    const bookingSeq = bookingSeqRes.rows[0]?.seq_name;

    const maxBookingRes = await client.query(`
      SELECT COALESCE(MAX("BookingID"), 0) as max_id FROM "cabbooking1_new"
    `);
    const maxBookingId = parseInt(maxBookingRes.rows[0].max_id, 10);

    if (bookingSeq) {
      const syncVal = Math.max(maxBookingId, 1);
      await client.query(`SELECT setval($1, $2, $3)`, [bookingSeq, syncVal, maxBookingId > 0]);
      console.log(`✅ cabbooking1_new.BookingID sequence synced:`);
      console.log(`   - Sequence: ${bookingSeq}`);
      console.log(`   - Max ID: ${maxBookingId}`);
      console.log(`   - Next Value will be: ${maxBookingId + 1}\n`);
    }

    // 2. APPROVAL_NOTIFICATIONS.ID
    const notifSeqRes = await client.query(`
      SELECT pg_get_serial_sequence('"APPROVAL_NOTIFICATIONS"', 'ID') as seq_name
    `);
    const notifSeq = notifSeqRes.rows[0]?.seq_name;

    const maxNotifRes = await client.query(`
      SELECT COALESCE(MAX("ID"), 0) as max_id FROM "APPROVAL_NOTIFICATIONS"
    `);
    const maxNotifId = parseInt(maxNotifRes.rows[0].max_id, 10);

    if (notifSeq) {
      const syncVal = Math.max(maxNotifId, 1);
      await client.query(`SELECT setval($1, $2, $3)`, [notifSeq, syncVal, maxNotifId > 0]);
      console.log(`✅ APPROVAL_NOTIFICATIONS.ID sequence synced:`);
      console.log(`   - Sequence: ${notifSeq}`);
      console.log(`   - Max ID: ${maxNotifId}`);
      console.log(`   - Next Value will be: ${maxNotifId + 1}\n`);
    }

    console.log('🎉 Sequence verification and synchronization complete!');
  } catch (error) {
    console.error('❌ Sequence verification failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyAndSyncSequences();
