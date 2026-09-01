/**
 * Test Utilities and Assertion Helpers for BHEL Transport Management System
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(description, fn) {
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      console.log(`  ${colors.green}✔ PASS${colors.reset}: ${description} (${duration}ms)`);
      this.passed++;
      this.tests.push({ description, status: 'PASS', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`  ${colors.red}✖ FAIL${colors.reset}: ${description} (${duration}ms)`);
      console.error(`    ${colors.red}Error: ${error.message}${colors.reset}`);
      if (error.stack) {
        console.error(`    ${colors.yellow}${error.stack.split('\n')[1]?.trim()}${colors.reset}`);
      }
      this.failed++;
      this.tests.push({ description, status: 'FAIL', duration, error: error.message });
    }
  }

  summary() {
    console.log(`\n${colors.bright}Test Summary for [${this.name}]:${colors.reset}`);
    console.log(`  Total:  ${this.tests.length}`);
    console.log(`  Passed: ${colors.green}${this.passed}${colors.reset}`);
    console.log(`  Failed: ${this.failed > 0 ? colors.red + this.failed : colors.green + '0'}${colors.reset}`);
    return this.failed === 0;
  }
}

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ' - ' : ''}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(value, message = '') {
  if (!value) {
    throw new Error(`${message ? message + ' - ' : ''}Expected truthy value but got ${value}`);
  }
}

module.exports = {
  TestSuite,
  assert,
  assertEquals,
  assertTruthy,
  colors
};
