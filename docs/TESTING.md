# BHEL Transport Management System - Testing Guide

## 1. Testing Philosophy
The BHEL Transport Portal follows a layered, non-destructive testing strategy:

1. **Unit Tests (`tests/unit/`)**: Fast, pure in-memory execution covering cryptographic hashing, token encoding/decoding, and validation rules.
2. **Database Invariants (`tests/database/`)**: Read-only validation of table presence, sequence alignment, and isolated transaction rollbacks (zero persistent changes).
3. **API Integration Smoke Tests (`tests/integration/`)**: Contract format, status codes, and header parser validation.
4. **End-to-End Tests (`playwright.config.ts`)**: Browser automation across complete user flows.

---

## 2. Test Execution Commands

| Command | Target Suite | Description |
|---|---|---|
| `npm run test:unit` | Unit Tests | Tests password hashing, tokens, and input sanitization |
| `npm run test:lifecycle` | Endpoint Lifecycle | Tests request validation, state machines, and template renderers |
| `npm run test:rbac` | RBAC Matrix | Tests positive & negative role access matrix across all boundaries |
| `npm run test:routes` | Route Handlers | Tests Next.js route handlers with Request/NextRequest payloads |
| `npm run test:db` | Database Invariants | Tests PostgreSQL connection, tables, accounts, rollback safety |
| `npm run test:constraints` | Constraint Regression | Tests database-level PK, NOT NULL, length, date & savepoint rollbacks |
| `npm run test:resilience` | Fault Tolerance | Tests credential shielding, malformed inputs, atomic rollbacks & races |
| `npm run test:security` | Security Audit | Tests HTTP security headers, JWT integrity, cookie flags, SQLi defense |
| `npm run test:stress` | Concurrency & Pool Stress | Tests 10-100 worker pool benchmark, sequence collision, 10 tenant flows |
| `npm test` | API Smoke Tests | Tests API responses, authentication envelopes, URL parameter sanitizers |
| `npm run test:all` | Master Runner | Runs all 10 specialized suites in unified execution (52/52 tests passing) |
| `npm run deploy:verify` | Deployment Smoke | Tests production artifact startup, readiness, live headers, route protection |
| `npm run db:test` | Neon Connectivity | Verifies database ping, latency, and audited objects |
| `npm run db:flows` | Business Lifecycle | Executes complete 6-step business lifecycle test with cleanup |
| `npm run db:sequences` | Sequences Verification | Verifies and resynchronizes PostgreSQL identity sequences |
| `npm run test:e2e` | Playwright E2E | Runs browser end-to-end test suite |

---

## 3. Test Invariants & Safety Rules

- **Zero Data Loss Invariant**: Tests must NEVER delete or modify live business records.
- **Rollback Isolation**: Database tests that verify write operations must use `BEGIN ... ROLLBACK` or dedicated test prefixes with automatic cleanup.
- **Sequence Preservation**: Sequence counters must not drift uncontrollably during automated testing.
