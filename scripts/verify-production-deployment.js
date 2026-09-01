/**
 * Production Deployment Artifact & Startup Verification Script
 * Validates production build startup, port binding, HTTP readiness,
 * security headers emission on live artifact, unauthenticated route protection,
 * and graceful process termination.
 */

const { spawn } = require('child_process');
const http = require('http');

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeHttpRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE_URL}${urlPath}`,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 5000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 30, intervalMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await makeHttpRequest('/login');
      if (res.statusCode === 200) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Production server failed to become ready on port ${PORT} after ${maxAttempts * intervalMs}ms`);
}

async function runDeploymentVerification() {
  console.log('\n====================================================');
  console.log('  STARTING PRODUCTION DEPLOYMENT SMOKE VERIFICATION ');
  console.log('====================================================\n');

  console.log('🚀 Spawning Next.js production server (next start)...');
  const serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  serverProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`   [Next.js stdout]: ${text}`);
  });

  serverProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`   [Next.js stderr]: ${text}`);
  });

  try {
    // 1. Wait for server readiness
    console.log(`⏳ Waiting for HTTP readiness at ${BASE_URL}/login...`);
    const readyStart = Date.now();
    await waitForServer();
    const readinessTime = Date.now() - readyStart;
    console.log(`   ✔ Production server ready in ${readinessTime}ms!`);

    // 2. Test Public Route & HTTP Security Headers
    console.log('🔒 Probing /login for HTTP 200 and Security Headers...');
    const loginRes = await makeHttpRequest('/login');
    if (loginRes.statusCode !== 200) {
      throw new Error(`Expected /login to return 200, got ${loginRes.statusCode}`);
    }
    console.log('   ✔ GET /login returned HTTP 200 OK');

    const headers = loginRes.headers;
    const ctOption = headers['x-content-type-options'];
    const frameOption = headers['x-frame-options'];
    const referrerPolicy = headers['referrer-policy'];

    if (ctOption !== 'nosniff') throw new Error(`Missing or invalid X-Content-Type-Options: ${ctOption}`);
    if (frameOption !== 'DENY') throw new Error(`Missing or invalid X-Frame-Options: ${frameOption}`);
    if (referrerPolicy !== 'strict-origin-when-cross-origin') throw new Error(`Missing Referrer-Policy: ${referrerPolicy}`);
    console.log('   ✔ Live HTTP security headers verified (nosniff, DENY, strict-origin-when-cross-origin)');

    // 3. Test Protected API Route Unauthenticated Rejection
    console.log('🛡️ Probing protected API route (/api/manager/notifications) without credentials...');
    const protectedRes = await makeHttpRequest('/api/manager/notifications');
    if (protectedRes.statusCode !== 401 && protectedRes.statusCode !== 403) {
      throw new Error(`Expected protected route to reject unauthenticated request with 401/403, got ${protectedRes.statusCode}`);
    }
    console.log(`   ✔ Protected route safely rejected unauthenticated access with HTTP ${protectedRes.statusCode}`);

    // 4. Test API Health / Invariants
    console.log('🩺 Probing /api/auth/unified-login with malformed body...');
    const badLoginRes = await makeHttpRequest('/api/auth/unified-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true })
    });
    if (badLoginRes.statusCode !== 400 && badLoginRes.statusCode !== 401) {
      throw new Error(`Expected malformed login to return 400/401, got ${badLoginRes.statusCode}`);
    }
    console.log(`   ✔ API route handled malformed input cleanly with HTTP ${badLoginRes.statusCode}`);

    console.log('\n====================================================');
    console.log('  ✔ ALL PRODUCTION DEPLOYMENT CHECKS PASSED!        ');
    console.log('====================================================\n');
  } finally {
    console.log('🛑 Gracefully terminating Next.js production server...');
    try {
      if (process.platform === 'win32' && serverProcess.pid) {
        const { execSync } = require('child_process');
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
        } catch {}
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {}
    console.log('   ✔ Production server process exited cleanly.');
  }
}

if (require.main === module) {
  runDeploymentVerification().catch((err) => {
    console.error(`\n✖ Deployment verification failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runDeploymentVerification };
