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

async function runSchemaMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Connecting to Neon PostgreSQL...');
    console.log('📄 Executing scripts/neon/01-init-schema.sql...');
    
    const schemaSql = fs.readFileSync(path.join(__dirname, '01-init-schema.sql'), 'utf-8');
    await client.query(schemaSql);
    
    console.log('✅ Schema migration completed successfully!');
    
    // Check tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Tables in public schema:');
    console.table(tableRes.rows);
  } catch (error) {
    console.error('❌ Schema migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSchemaMigration();
