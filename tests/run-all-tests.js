/**
 * Master Test Suite Runner for BHEL Transport Management System
 */

const { runUnitTests } = require('./unit/security-validation.test');
const { runApiTests } = require('./integration/api-smoke.test');
const { runEndpointLifecycleTests } = require('./integration/endpoint-lifecycle.test');
const { runRbacMatrixTests } = require('./integration/rbac-matrix.test');
const { runRouteHandlersIntegrationTests } = require('./integration/route-handlers.integration.test');
const { runDatabaseTests } = require('./database/database-invariants.test');
const { runDatabaseConstraintsTests } = require('./database/database-constraints-regression.test');
const { runFaultToleranceTests } = require('./integration/fault-tolerance.test');
const { runSecurityAuditTests } = require('./security/security-audit.test');
const { runConcurrencyPoolStressTests } = require('./stress/concurrency-pool-stress.test');
const { colors } = require('./helpers/test-utils');

async function main() {
  console.log(`\n${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.bright}  BHEL TRANSPORT PORTAL - COMPLETE TEST CERTIFICATION SUITE    ${colors.reset}`);
  console.log(`${colors.bright}================================================================${colors.reset}\n`);

  try {
    // [1/10] Unit Tests (Pure Functions & Security)
    await runUnitTests();

    // [2/10] API Smoke Tests
    await runApiTests();

    // [3/10] Endpoint Lifecycle Tests
    await runEndpointLifecycleTests();

    // [4/10] RBAC Positive & Negative Matrix Tests
    await runRbacMatrixTests();

    // [5/10] Next.js Route Handlers Integration Tests
    await runRouteHandlersIntegrationTests();

    // [6/10] Database Invariants Tests
    await runDatabaseTests();

    // [7/10] Database Constraints & Regression Tests
    await runDatabaseConstraintsTests();

    // [8/10] Fault Tolerance & Error-Path Resilience Tests
    await runFaultToleranceTests();

    // [9/10] Application Security & Vulnerability Audit Tests
    await runSecurityAuditTests();

    // [10/10] Concurrency, Pool Stress & Recovery Tests
    await runConcurrencyPoolStressTests();

    console.log(`\n${colors.bright}${colors.green}================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.green}  ✔ ALL TEST SUITES EXECUTED AND PASSED SUCCESSFULLY!          ${colors.reset}`);
    console.log(`${colors.bright}${colors.green}================================================================${colors.reset}\n`);
  } catch (err) {
    console.error(`\n${colors.bright}${colors.red}================================================================${colors.reset}`);
    console.error(`${colors.bright}${colors.red}  ✖ TEST SUITE RUNNER FAILED: ${err.message}                   ${colors.reset}`);
    console.error(`${colors.bright}${colors.red}================================================================${colors.reset}\n`);
    process.exit(1);
  }
}

main();
