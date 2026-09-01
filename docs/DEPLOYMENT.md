# BHEL Transport Management System - Production Deployment Guide

## 1. Prerequisites
- **Node.js**: >= 18.18.0 (Node 20 or 22 LTS recommended)
- **Database**: Neon Serverless PostgreSQL instance with public or VPC endpoint
- **Package Manager**: NPM >= 9.x

---

## 2. Environment Variables Configuration
Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set the required environment keys:
```ini
# Primary Neon PostgreSQL Connection URL
DATABASE_URL=postgresql://username:password@host/neondb?sslmode=require

# Security Secrets
JWT_SECRET=production-32-character-random-secret
SESSION_SECRET=production-32-character-session-secret

# Node Environment
NODE_ENV=production
```

---

## 3. Database Initialization & Schema Provisioning
Run the schema initialization and sequence check scripts:

```bash
# 1. Verify connection
npm run db:test

# 2. Run DDL migration (if configuring new instance)
npm run db:migrate

# 3. Seed initial master accounts (idempotent)
npm run db:seed

# 4. Synchronize sequence counters
npm run db:sequences
```

---

## 4. Production Build & Execution

```bash
# 1. Install production dependencies
npm ci

# 2. Compile optimized production build
npm run build

# 3. Start Next.js production server
npm run start
```

Default port is `3000`. To customize port:
```bash
PORT=8080 npm run start
```

---

## 5. Deployment Verification & Smoke Test

Execute the automated production artifact verification script to test server startup, readiness, live HTTP security headers, and route protection:

```bash
npm run deploy:verify
```

---

## 6. Health Check Endpoints & Monitoring
- **UI Connectivity Check**: `/db-test`
- **Authentication Route Check**: `GET /login`
- **Protected API Probe**: `GET /api/manager/notifications` (Returns `401 Unauthorized` without credentials)
