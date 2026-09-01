# BHEL Transport Management System - Security & Compliance Guide

## 1. Security Architecture & Threat Model
The BHEL Transport Portal implements multi-layered enterprise defense mechanisms to safeguard employee transport requests, organizational hierarchy, and credential databases.

---

## 2. Authentication & Credential Storage

### 2.1 Password Hashing Strategy
- **Algorithm**: `bcrypt` (10 salt rounds minimum)
- **Automatic Legacy Migration**: When legacy accounts authenticate with plain text passwords, the backend automatically computes a secure bcrypt hash, updates `password_hash` in `axusers`, and clears the plaintext field.
- **Hash Verification**: Using constant-time comparisons (`bcrypt.compare`) to prevent timing attacks.

### 2.2 Token Issuance & Session Management
- **Token Mechanism**: Standard JSON Web Tokens (JWT) signed via `jose` using HS256 and symmetric encryption keys (`JWT_SECRET`).
- **Cryptographic Claims**: Includes `iss` (`bhel-transport-system`), `aud` (`bhel-employees`), `iat`, `exp`, `jti`, and `sessionId`.
- **Cookie Security Policy**:
  - `HttpOnly`: Accessible only by server HTTP endpoints, completely shielded from browser JavaScript / XSS exfiltration.
  - `Secure`: Transmitted strictly over HTTPS in production (`process.env.NODE_ENV === 'production'`).
  - `SameSite=strict`: Maximum protection against Cross-Site Request Forgery (CSRF).
  - `Path=/`: Scoped to root domain session.
  - `maxAge`: 3600 seconds (1 hour) for access tokens, 7 days for refresh tokens.

---

## 3. HTTP Security Headers & Defense-in-Depth

Configured in `next.config.js` and verified by automated audit tests:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects referrer data in cross-origin requests |
| `X-XSS-Protection` | `1; mode=block` | Enables legacy browser XSS filters |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unused hardware device APIs |
| `Cache-Control` | `private, max-age=60` | Restricts caching of sensitive API responses |

## 3. Role-Based Access Control (RBAC)

The access boundary is enforced at both Next.js edge middleware and server route handlers.

| Role | Access Permissions | Permitted Routes |
|---|---|---|
| **Employee** | Create bookings, view own history, download responses | `/dashboard`, `/api/ride-submission`, `/api/bookings/*`, `/api/download-response/*` |
| **Manager** | View subordinate requests, approve/reject trips, receive alerts | `/manager-dashboard`, `/api/approvals/*`, `/api/manager/*` |
| **Transport Desk** | View approved pool, allot vehicles/drivers, issue passes | `/transport-dashboard`, `/api/transport/*` |

### Middleware Enforcement (`middleware.ts`)
Unauthorized requests to protected routes (`/dashboard`, `/manager-dashboard`, `/transport-dashboard`) are intercepted at the edge and redirected to `/login` with clean role contextualization.

---

## 4. SQL Injection Defense & Transaction Safety

1. **Parameterized Queries**: 100% of database queries use PostgreSQL parameterized variables (`$1`, `$2`, `$3`...) through `lib/database.ts`. Zero string interpolation or inline SQL concatenation is permitted.
2. **Transaction Isolation**: Multi-table state transitions (e.g. Booking Creation + Notification Insert) execute within atomic transaction blocks (`BEGIN ... COMMIT / ROLLBACK`).
3. **Automatic Retry with Jitter**: Transient network interruptions are retried with exponential backoff and jitter (`withDatabaseRetry`).

---

## 5. Security Checklist for Production Deployment

- [ ] Ensure `JWT_SECRET` is set to a cryptographically secure random string (> 32 characters).
- [ ] Set `NODE_ENV=production` to enable strict HTTPS cookie enforcement.
- [ ] Confirm `DATABASE_URL` connects via `sslmode=require` or `sslmode=verify-full`.
- [ ] Ensure `.env` is excluded from git tracking (`.gitignore`).
- [ ] Restrict `ALLOWED_ORIGINS` to trusted enterprise domain names.
