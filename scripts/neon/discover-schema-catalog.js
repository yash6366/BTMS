/**
 * Database Schema, Constraint & Trigger Catalog Discovery Script
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    console.log('--- 1. TABLE INVENTORY ---');
    const tables = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.table(tables.rows);

    console.log('\n--- 2. CONSTRAINTS (PK, UNIQUE, FK, CHECK) ---');
    const constraints = await pool.query(`
      SELECT 
        conrelid::regclass::text AS table_name,
        conname AS constraint_name,
        CASE contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
          WHEN 'x' THEN 'EXCLUSION'
          ELSE contype::text
        END AS constraint_type,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY table_name, constraint_type, constraint_name
    `);
    console.table(constraints.rows);

    console.log('\n--- 3. USER-DEFINED TRIGGERS ---');
    const triggers = await pool.query(`
      SELECT 
        c.relname AS table_name,
        t.tgname AS trigger_name,
        pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
      ORDER BY table_name, trigger_name
    `);
    if (triggers.rows.length === 0) {
      console.log('No user-defined triggers in public schema.');
    } else {
      console.table(triggers.rows);
    }

    console.log('\n--- 4. NOT NULL & COLUMN LENGTHS ---');
    const cols = await pool.query(`
      SELECT 
        table_name,
        column_name,
        is_nullable,
        data_type,
        character_maximum_length,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('axusers', 'cabbooking1_new', 'CABBOOKING_DETAILS', 'APPROVAL_NOTIFICATIONS', 'EDN_PIS_EMPLOYEE_MASTER_VIEW')
      ORDER BY table_name, ordinal_position
    `);
    console.table(cols.rows);

    console.log('\n--- 5. INDEXES ---');
    const indexes = await pool.query(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    console.table(indexes.rows);

  } catch (err) {
    console.error('Discovery error:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
