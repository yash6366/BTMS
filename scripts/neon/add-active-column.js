const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: true }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking EDN_PIS_EMPLOYEE_MASTER_VIEW schema...');
    
    // Add ACTIVE column to EDN_PIS_EMPLOYEE_MASTER_VIEW
    await client.query(`
      ALTER TABLE "EDN_PIS_EMPLOYEE_MASTER_VIEW" 
      ADD COLUMN IF NOT EXISTS "ACTIVE" VARCHAR(1) DEFAULT '1';
    `);
    
    await client.query(`
      UPDATE "EDN_PIS_EMPLOYEE_MASTER_VIEW" 
      SET "ACTIVE" = '1' 
      WHERE "ACTIVE" IS NULL;
    `);

    // Verify columns
    const cols = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'EDN_PIS_EMPLOYEE_MASTER_VIEW'
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ EDN_PIS_EMPLOYEE_MASTER_VIEW columns:');
    console.table(cols.rows);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
