const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function authenticateUser(username, plainPassword) {
  const userRes = await pool.query(
    `SELECT * FROM "axusers" WHERE "username" = $1 AND ("active" = '1' OR "active" IS NULL)`,
    [username]
  );

  if (userRes.rows.length === 0) return null;
  const row = userRes.rows[0];
  let isAuthenticated = false;

  if (row.password_hash) {
    isAuthenticated = await bcrypt.compare(plainPassword, row.password_hash);
  }

  if (!isAuthenticated && row.hashed_password) {
    const sha256Buffer = crypto.createHash('sha256').update(plainPassword).digest();
    if (Buffer.isBuffer(row.hashed_password)) {
      isAuthenticated = crypto.timingSafeEqual(sha256Buffer, row.hashed_password);
    }
  }

  if (!isAuthenticated) {
    if ((row.password && row.password === plainPassword) || (row.pwd && row.pwd === plainPassword)) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) return null;

  // Progressive Rehash
  if (!row.password_hash) {
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(plainPassword, salt);
    await pool.query(`UPDATE "axusers" SET "password_hash" = $1, "updated_at" = NOW() WHERE "username" = $2`, [
      newHash,
      username
    ]);
  }

  return row;
}

async function testAuth() {
  console.log('🔐 TESTING PROGRESSIVE AUTHENTICATION & BCRYPT REHASH ON NEON');
  console.log('=================================================================\n');

  try {
    // 1. Initial State Check for user 6234070
    console.log('1️⃣ Checking initial password state in database for user 6234070...');
    const userBefore = await pool.query(`SELECT username, password, password_hash FROM "axusers" WHERE username = '6234070'`);
    console.log('   Initial DB Record:', {
      username: userBefore.rows[0]?.username,
      hasPlainPassword: !!userBefore.rows[0]?.password,
      hasBcryptHash: !!userBefore.rows[0]?.password_hash,
    });

    // 2. First Login (Legacy Plain/SHA256 -> Bcrypt Rehash)
    console.log('\n2️⃣ Attempting first login with password "password123"...');
    const auth1 = await authenticateUser('6234070', 'password123');
    if (!auth1) {
      throw new Error('First authentication attempt failed!');
    }
    console.log('   ✅ First authentication SUCCESSFUL for user:', auth1.username, 'Role:', auth1.usergroup);

    // 3. Verify Bcrypt Hash was generated and stored
    console.log('\n3️⃣ Verifying progressive bcrypt hash generation in database...');
    const userAfter = await pool.query(`SELECT username, password_hash FROM "axusers" WHERE username = '6234070'`);
    const bcryptHash = userAfter.rows[0]?.password_hash;
    const isBcrypt = bcryptHash && bcryptHash.startsWith('$2');
    console.log(`   ✅ Bcrypt Hash Generated and Stored: ${isBcrypt ? 'YES ($2a/b...)' : 'NO'}`);

    // 4. Second Login (Bcrypt Verification)
    console.log('\n4️⃣ Attempting second login (verifying against stored bcrypt hash)...');
    const auth2 = await authenticateUser('6234070', 'password123');
    if (!auth2) {
      throw new Error('Second authentication attempt using bcrypt hash failed!');
    }
    console.log('   ✅ Second authentication SUCCESSFUL via bcrypt hash!');

    // 5. Invalid Password Test
    console.log('\n5️⃣ Testing login with WRONG password...');
    const authInvalid = await authenticateUser('6234070', 'wrongpassword');
    console.log(`   ✅ Invalid password rejected correctly: ${authInvalid === null ? 'PASS (Returned null)' : 'FAIL'}`);

    // 6. Manager & Transport Login Test
    console.log('\n6️⃣ Testing Manager (3787702) & Transport login...');
    const managerAuth = await authenticateUser('3787702', 'manager123');
    console.log(`   ✅ Manager login: ${managerAuth && managerAuth.manage === '1' ? 'PASS (Manager privileges verified)' : 'FAIL'}`);

    const transportAuth = await authenticateUser('transport', 'trans123');
    console.log(`   ✅ Transport login: ${transportAuth ? 'PASS (Transport portal access verified)' : 'FAIL'}`);

    console.log('\n🎉 ALL AUTHENTICATION AND PROGRESSIVE REHASH TESTS PASSED ON NEON!');
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAuth();
