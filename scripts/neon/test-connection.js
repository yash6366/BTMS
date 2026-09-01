const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true }
});

async function testNeonConnection() {
  const startTime = Date.now();
  let client;
  try {
    console.log('🔄 Testing Neon PostgreSQL connection...');
    client = await pool.connect();
    const connectTime = Date.now() - startTime;
    console.log(`✅ Connected in ${connectTime}ms`);

    const result = await client.query('SELECT NOW() as current_time, version() as pg_version, current_database() as database_name');
    console.log('\n📊 Connection Details:');
    console.log('  Database:', result.rows[0].database_name);
    console.log('  Server Time:', result.rows[0].current_time);
    console.log('  Version:', result.rows[0].pg_version.split(',')[0]);

    // Check audited tables
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('axusers', 'cabbooking1_new', 'CABBOOKING_DETAILS', 'APPROVAL_NOTIFICATIONS', 'EDN_PIS_EMPLOYEE_MASTER_VIEW')
    `);

    console.log('\n📋 Audited Objects Presence:');
    console.table(tablesCheck.rows);

    console.log('🎉 Neon connection test passed successfully!');
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

testNeonConnection();
