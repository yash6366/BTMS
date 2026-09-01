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

async function reconcileData() {
  console.log('🔍 DATA RECONCILIATION AUDIT: MSSQL vs Neon PostgreSQL');
  console.log('========================================================\n');
  let mssqlPool;
  let pgClient;

  try {
    mssqlPool = await sql.connect(mssqlConfig);
    pgClient = await pgPool.connect();

    const tables = ['axusers', 'cabbooking1_new', 'CABBOOKING_DETAILS', 'APPROVAL_NOTIFICATIONS'];
    const results = [];

    for (const table of tables) {
      try {
        // MSSQL count
        const msRes = await mssqlPool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`);
        const msCount = msRes.recordset[0].cnt;

        // PG count
        const pgRes = await pgClient.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
        const pgCount = parseInt(pgRes.rows[0].cnt, 10);

        const diff = pgCount - msCount;
        const match = diff === 0 ? '✅ MATCH' : '⚠️ MISMATCH';

        results.push({
          Table: table,
          'MSSQL Rows': msCount,
          'Neon Rows': pgCount,
          Difference: diff,
          Status: match
        });
      } catch (tableErr) {
        results.push({
          Table: table,
          'MSSQL Rows': 'N/A',
          'Neon Rows': 'N/A',
          Difference: 'ERROR',
          Status: `⚠️ ${tableErr.message}`
        });
      }
    }

    console.table(results);

    // Sequence Check
    console.log('\n🔢 Sequence Reconciliation Check:');
    const seqs = [
      { table: 'cabbooking1_new', col: 'BookingID' },
      { table: 'APPROVAL_NOTIFICATIONS', col: 'ID' }
    ];

    for (const s of seqs) {
      const maxRes = await pgClient.query(`SELECT COALESCE(MAX("${s.col}"), 0) as max_id FROM "${s.table}"`);
      const maxId = parseInt(maxRes.rows[0].max_id, 10);
      const seqNameRes = await pgClient.query(`SELECT pg_get_serial_sequence('"${s.table}"', '${s.col}') as seq_name`);
      const seqName = seqNameRes.rows[0]?.seq_name;

      if (seqName) {
        const lastValRes = await pgClient.query(`SELECT last_value, is_called FROM ${seqName}`);
        const lastVal = lastValRes.rows[0];
        console.log(`  Table "${s.table}" ("${s.col}"):`);
        console.log(`    Max ID in table: ${maxId}`);
        console.log(`    Sequence last_value: ${lastVal.last_value}, is_called: ${lastVal.is_called}`);
        console.log(`    Status: ${maxId <= parseInt(lastVal.last_value, 10) ? '✅ SAFE' : '⚠️ RE-SYNC NEEDED'}`);
      }
    }

    console.log('\n🎉 Data Reconciliation Audit Completed!');
  } catch (error) {
    console.error('❌ Reconciliation failed:', error.message);
  } finally {
    if (mssqlPool) await mssqlPool.close();
    if (pgClient) pgClient.release();
    await pgPool.end();
  }
}

reconcileData();
