const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  console.error('Please configure DATABASE_URL in your .env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: true }
});

async function runSeedData() {
  const client = await pool.connect();
  try {
    console.log('🚀 Connecting to Neon PostgreSQL...');
    console.log('📄 Executing scripts/neon/02-seed-data.sql...');
    
    const seedSql = fs.readFileSync(path.join(__dirname, '02-seed-data.sql'), 'utf-8');
    await client.query(seedSql);
    
    console.log('✅ Seed data executed successfully (idempotent ON CONFLICT DO NOTHING)!');
    
    // Verify seed accounts
    const userRes = await client.query(`
      SELECT username, usergroup, email, pageaccess, active 
      FROM "axusers" 
      WHERE username IN ('2408004', '6234070', '3787702', 'transport');
    `);
    
    console.log('\n📊 Seed Users Status:');
    console.table(userRes.rows);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeedData();
