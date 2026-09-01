import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg"
import bcrypt from "bcryptjs"
import crypto from "crypto"

// Initialize database configuration using PostgreSQL connection string
declare global {
  var __btmsPgPool: Pool | undefined
}

function createNewPool(): Pool {
  const connectionString = process.env.DATABASE_URL || ""
  let sslConfig: boolean | { rejectUnauthorized: boolean } | undefined = undefined
  if (connectionString) {
    sslConfig = connectionString.includes("localhost")
      ? false
      : { rejectUnauthorized: false }
  } else if (process.env.NODE_ENV === "production" || connectionString.includes("sslmode=require")) {
    sslConfig = { rejectUnauthorized: false }
  }

  const pool = new Pool({
    connectionString: connectionString || undefined,
    host: !connectionString ? (process.env.DB_HOST || process.env.PGHOST || "localhost") : undefined,
    port: !connectionString ? parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10) : undefined,
    database: !connectionString ? (process.env.DB_DATABASE || process.env.PGDATABASE || "bheldb") : undefined,
    user: !connectionString ? (process.env.DB_USER || process.env.PGUSER || "postgres") : undefined,
    password: !connectionString ? (process.env.DB_PASSWORD || process.env.PGPASSWORD || "") : undefined,
    ssl: sslConfig,
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
  })

  pool.on("error", (err) => {
    console.warn("PostgreSQL Pool client idle notice:", (err as Error)?.message || err)
  })

  return pool
}

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    if (!globalThis.__btmsPgPool) {
      globalThis.__btmsPgPool = createNewPool()
    }
    return globalThis.__btmsPgPool
  }

  // Preserve single pool across HMR in development
  if (!globalThis.__btmsPgPool) {
    globalThis.__btmsPgPool = createNewPool()
  }
  return globalThis.__btmsPgPool
}

export async function connectToDatabase(): Promise<Pool> {
  const pool = getPool()
  return pool
}

function isTransientConnectionError(error: unknown): boolean {
  if (!error) return false
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  const code = (error as { code?: string })?.code
  return (
    msg.includes("connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("socket closed") ||
    msg.includes("client has encountered a connection error") ||
    msg.includes("terminating connection") ||
    msg.includes("server closed the connection") ||
    msg.includes("unexpectedly") ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "08006" ||
    code === "08001" ||
    code === "08000" ||
    code === "08003" ||
    code === "08004"
  )
}

/**
 * Execute parameterized query safely using PostgreSQL driver with auto-retry
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  maxRetries = 1
): Promise<QueryResult<T>> {
  let attempts = 0
  while (attempts <= maxRetries) {
    try {
      const pool = getPool()
      const start = Date.now()
      const res = await pool.query<T>(text, params)
      const duration = Date.now() - start
      if (process.env.NODE_ENV === "development" && duration > 1000) {
        console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`)
      }
      return res
    } catch (error) {
      attempts++
      if (attempts <= maxRetries && isTransientConnectionError(error)) {
        console.warn(`Database connection dropped. Retrying query (attempt ${attempts}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, attempts * 250))
        continue
      }
      console.error("Database query error:", error instanceof Error ? error.message : "Unknown error")
      throw error
    }
  }
  throw new Error("Query failed after retries")
}

/**
 * Helper function with retry logic for transient connection issues
 */
export async function withDatabaseRetry<T>(
  operation: (pool: Pool) => Promise<T>,
  retries: number = 3
): Promise<T> {
  while (retries > 0) {
    try {
      const pool = getPool()
      return await operation(pool)
    } catch (error) {
      retries--
      if (retries === 0) throw error
      console.warn(`Database operation failed, retrying (${retries} attempts left)...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  throw new Error("Database retry operation failed")
}

/**
 * Transaction helper ensuring atomic execution, automatic commit, and rollback on error
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let attempts = 0
  while (attempts <= maxRetries) {
    let client: PoolClient | null = null
    try {
      const pool = getPool()
      client = await pool.connect()
      await client.query("BEGIN")
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK")
        } catch {
          // ignore rollback errors if connection was severed
        }
      }
      attempts++
      if (attempts <= maxRetries && isTransientConnectionError(error)) {
        console.warn(`Transaction connection dropped. Retrying (attempt ${attempts}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, attempts * 400))
        continue
      }
      console.error("Transaction rolled back due to error:", error)
      throw error
    } finally {
      if (client) {
        try {
          client.release()
        } catch {
          // ignore release errors on closed sockets
        }
      }
    }
  }
  throw new Error("Transaction failed after retries")
}

/**
 * Database health check verifying NOW() and query latency
 */
export async function databaseHealthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
  try {
    const start = Date.now()
    const result = await query(`
      SELECT 
        NOW() as server_time,
        current_database() as database_name,
        current_user as current_user,
        version() as version
    `)
    const responseTime = Date.now() - start

    return {
      healthy: result.rows.length > 0,
      details: {
        responseTime,
        serverTime: result.rows[0]?.server_time,
        database: result.rows[0]?.database_name,
        user: result.rows[0]?.current_user,
        poolTotal: getPool().totalCount,
        poolIdle: getPool().idleCount,
        poolWaiting: getPool().waitingCount,
      },
    }
  } catch (error) {
    console.error("Database health check failed:", error)
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }
  }
}

/**
 * Test database connection and report table inventory
 */
export async function testDatabaseConnection() {
  try {
    const start = Date.now()
    const result = await query("SELECT 1 as test, NOW() as current_time")

    // Check tables presence
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('axusers', 'cabbooking1_new', 'CABBOOKING_DETAILS', 'APPROVAL_NOTIFICATIONS')
    `)

    let totalUsers = 0
    let activeUsers = 0
    const hasUsersTable = tableCheck.rows.some((r) => r.table_name === "axusers")

    if (hasUsersTable) {
      const countRes = await query(`SELECT COUNT(*) as total_users FROM "axusers"`)
      const activeRes = await query(`SELECT COUNT(*) as active_users FROM "axusers" WHERE "active" = '1'`)
      totalUsers = parseInt(countRes.rows[0]?.total_users || "0", 10)
      activeUsers = parseInt(activeRes.rows[0]?.active_users || "0", 10)
    }

    return {
      connectionTest: result.rows[0]?.test === 1 ? "SUCCESS" : "FAILED",
      responseTimeMs: Date.now() - start,
      tables: tableCheck.rows.map((r) => r.table_name),
      axusersTable: {
        exists: hasUsersTable,
        totalUsers,
        activeUsers,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    throw new Error(`Database connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

/**
 * User interface
 */
export interface DBUser {
  username: string
  usergroup: string
  groupno?: string
  build?: string
  manage?: string
  tools?: string
  email?: string
  pageaccess?: string
  active?: string
  reportingto?: string
}

/**
 * Progressive User Authentication with Automatic Bcrypt Hash Upgrade
 */
export async function authenticateUser(username: string, plainPassword: string): Promise<DBUser | null> {
  try {
    const userRes = await query(
      `
      SELECT 
        "username",
        "password",
        "pwd",
        "hashed_password",
        "password_hash",
        "usergroup",
        "groupno",
        "build",
        "manage",
        "tools",
        "email",
        "pageaccess",
        "active",
        "Reportingto"
      FROM "axusers"
      WHERE "username" = $1
      AND ("active" = '1' OR "active" IS NULL)
    `,
      [username]
    )

    if (userRes.rows.length === 0) {
      return null
    }

    const row = userRes.rows[0]
    let isAuthenticated = false

    // Method 1: Check modern bcrypt hash if available
    if (row.password_hash) {
      isAuthenticated = await bcrypt.compare(plainPassword, row.password_hash)
    }

    // Method 2: Check legacy SHA256 hashed_password if not verified yet
    if (!isAuthenticated && row.hashed_password) {
      const sha256Buffer = crypto.createHash("sha256").update(plainPassword).digest()
      if (Buffer.isBuffer(row.hashed_password)) {
        isAuthenticated = crypto.timingSafeEqual(sha256Buffer, row.hashed_password)
      } else if (typeof row.hashed_password === "string") {
        const hexHash = crypto.createHash("sha256").update(plainPassword).digest("hex")
        isAuthenticated = row.hashed_password.toLowerCase() === hexHash.toLowerCase()
      }
    }

    // Method 3: Legacy plain text password/pwd fallback for backward compatibility
    let matchedViaPlainFallback = false
    if (!isAuthenticated) {
      const stored = row.password || row.pwd
      if (stored) {
        if (
          stored === plainPassword ||
          stored.trim() === plainPassword.trim() ||
          (stored.endsWith(".") && stored.slice(0, -1) === plainPassword.trim()) ||
          (plainPassword.endsWith(".") && plainPassword.slice(0, -1) === stored.trim())
        ) {
          isAuthenticated = true
          matchedViaPlainFallback = true
        }
      }
    }

    if (!isAuthenticated) {
      return null
    }

    // Progressive Rehash: Upgrade user to bcrypt hash in background if missing or authenticated via plain fallback
    if (!row.password_hash || matchedViaPlainFallback) {
      try {
        const salt = await bcrypt.genSalt(10)
        const newHash = await bcrypt.hash(plainPassword, salt)
        await query(
          `UPDATE "axusers" SET "password_hash" = $1, "updated_at" = NOW() WHERE "username" = $2`,
          [newHash, username]
        )
      } catch (hashErr) {
        console.warn("Failed to progressively upgrade password hash:", hashErr)
      }
    }

    return {
      username: row.username,
      usergroup: row.usergroup,
      groupno: row.groupno,
      build: row.build,
      manage: row.manage,
      tools: row.tools,
      email: row.email,
      pageaccess: row.pageaccess,
      active: row.active,
      reportingto: row.Reportingto,
    }
  } catch (error) {
    console.error("Authentication error:", error)
    throw error
  }
}

/**
 * Transport-specific user authentication
 */
export async function authenticateTransportUser(username: string, password: string): Promise<DBUser | null> {
  const user = await authenticateUser(username, password)
  if (!user) return null

  const isTransport =
    user.tools === "1" ||
    user.tools === "Y" ||
    user.usergroup?.toLowerCase().includes("transport") ||
    user.username?.toLowerCase() === "transport"

  if (isTransport) {
    return user
  }
  return null
}

/**
 * Retrieve user details by username
 */
export async function getUserByUsername(username: string): Promise<DBUser | null> {
  try {
    const res = await query(
      `
      SELECT 
        "username",
        "usergroup",
        "groupno",
        "build",
        "manage",
        "tools",
        "email",
        "pageaccess",
        "active",
        "Reportingto"
      FROM "axusers"
      WHERE "username" = $1
    `,
      [username]
    )

    if (res.rows.length === 0) return null

    const row = res.rows[0]
    return {
      username: row.username,
      usergroup: row.usergroup,
      groupno: row.groupno,
      build: row.build,
      manage: row.manage,
      tools: row.tools,
      email: row.email,
      pageaccess: row.pageaccess,
      active: row.active,
      reportingto: row.Reportingto,
    }
  } catch (error) {
    console.error("getUserByUsername error:", error)
    throw error
  }
}

/**
 * Master employee record interface
 */
export interface MasterEmployee {
  empId: string
  firstName: string
  middleName?: string
  lastName: string
  designation: string
  email: string
  department: string
  fullName: string
}

export interface VerificationResult {
  verified: boolean
  alreadyRegistered?: boolean
  employee?: MasterEmployee
  message?: string
}

/**
 * Verify employee identity against authoritative EDN_PIS_EMPLOYEE_MASTER_VIEW
 */
export async function verifyEmployeeMaster(staffNo: string, email: string): Promise<VerificationResult> {
  try {
    const cleanStaffNo = staffNo.trim()
    const cleanEmail = email.trim().toLowerCase()

    // 1. Check if user is already registered in axusers
    const existingUser = await query(
      `SELECT "username" FROM "axusers" WHERE LOWER(TRIM("username")) = LOWER($1) OR LOWER(TRIM("email")) = $2`,
      [cleanStaffNo, cleanEmail]
    )

    if (existingUser.rows.length > 0) {
      return {
        verified: false,
        alreadyRegistered: true,
        message: "An account already exists for the supplied employee identity. Please sign in or contact support.",
      }
    }

    // 2. Query authoritative Master Directory
    const masterRes = await query(
      `
      SELECT 
        "EMP_ID",
        "EMP_FNAME",
        "EMP_MNAME",
        "EMP_LNAME",
        "EMP_DESIGNATION",
        "EMP_EMAIL_ID",
        "DEPT"
      FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW"
      WHERE LOWER(TRIM("EMP_ID")) = LOWER($1)
      AND LOWER(TRIM("EMP_EMAIL_ID")) = $2
    `,
      [cleanStaffNo, cleanEmail]
    )

    if (masterRes.rows.length === 0) {
      return {
        verified: false,
        message: "Employee verification failed. Please verify your Staff Number and official BHEL email with the IT Directory.",
      }
    }

    const row = masterRes.rows[0]
    const nameParts = [row.EMP_FNAME, row.EMP_MNAME, row.EMP_LNAME].filter((part: string) => part && part.trim())
    const fullName = nameParts.join(" ") || row.EMP_FNAME || row.EMP_ID

    return {
      verified: true,
      employee: {
        empId: row.EMP_ID,
        firstName: row.EMP_FNAME || "",
        middleName: row.EMP_MNAME || "",
        lastName: row.EMP_LNAME || "",
        designation: row.EMP_DESIGNATION || "",
        email: row.EMP_EMAIL_ID || cleanEmail,
        department: row.DEPT || "",
        fullName,
      },
    }
  } catch (error) {
    console.error("verifyEmployeeMaster error:", error)
    throw error
  }
}

export interface RegisterAccountParams {
  staffNo: string
  officialEmail: string
  mobile: string
  password: string
  requestedRole?: "employee" | "manager" | "transport"
  reportingTo?: string
  clientIP?: string
}

export interface RegistrationResult {
  success: boolean
  staffNo: string
  status: "ACTIVE" | "PENDING_REVIEW"
  requestedRole: string
  effectiveRole: string
  message: string
}

/**
 * Register a new employee account with transactional integrity and zero privilege escalation.
 * Authoritative master data is always derived from EDN_PIS_EMPLOYEE_MASTER_VIEW.
 */
export async function registerEmployeeAccount(params: RegisterAccountParams): Promise<RegistrationResult> {
  const cleanStaffNo = params.staffNo.trim()
  const cleanEmail = params.officialEmail.trim().toLowerCase()
  const requestedRole = params.requestedRole || "employee"

  return await withTransaction(async (client) => {
    // 1. Re-verify employee against master view within transaction
    const masterRes = await client.query(
      `
      SELECT 
        "EMP_ID",
        "EMP_FNAME",
        "EMP_MNAME",
        "EMP_LNAME",
        "EMP_DESIGNATION",
        "EMP_EMAIL_ID",
        "DEPT"
      FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW"
      WHERE LOWER(TRIM("EMP_ID")) = LOWER($1)
      AND LOWER(TRIM("EMP_EMAIL_ID")) = $2
    `,
      [cleanStaffNo, cleanEmail]
    )

    if (masterRes.rows.length === 0) {
      throw new Error("EMPLOYEE_VERIFICATION_FAILED")
    }

    const masterEmployee = masterRes.rows[0]

    // 2. Check for duplicate account in axusers
    const existing = await client.query(
      `SELECT "username" FROM "axusers" WHERE LOWER(TRIM("username")) = LOWER($1) OR LOWER(TRIM("email")) = $2`,
      [cleanStaffNo, cleanEmail]
    )

    if (existing.rows.length > 0) {
      throw new Error("ACCOUNT_ALREADY_EXISTS")
    }

    // 3. Hash password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(params.password, salt)

    // 4. Enforce strict server-controlled RBAC
    // Public self-registration ALWAYS receives non-privileged permissions
    const effectiveRole = "Employee"
    const manage = "0"
    const build = "0"
    const tools = "0"
    const usergroup = "Employee"
    const pageaccess = "employee"
    const groupno = "EMP01"

    // If privileged role was requested, account requires administrative activation (active = '0')
    // Standard employee accounts are activated immediately (active = '1')
    const isElevatedRequest = requestedRole === "manager" || requestedRole === "transport"
    const active = isElevatedRequest ? "0" : "1"
    const status: "ACTIVE" | "PENDING_REVIEW" = isElevatedRequest ? "PENDING_REVIEW" : "ACTIVE"

    // Validate reportingTo if provided
    let verifiedReportingTo: string | null = null
    if (params.reportingTo && params.reportingTo.trim()) {
      const repRes = await client.query(
        `SELECT "EMP_ID" FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW" WHERE LOWER(TRIM("EMP_ID")) = LOWER($1)`,
        [params.reportingTo.trim()]
      )
      if (repRes.rows.length > 0) {
        verifiedReportingTo = repRes.rows[0].EMP_ID
      }
    }

    // 5. Insert account record into axusers
    await client.query(
      `
      INSERT INTO "axusers" (
        "username",
        "password_hash",
        "usergroup",
        "groupno",
        "build",
        "manage",
        "tools",
        "email",
        "pageaccess",
        "active",
        "Reportingto",
        "created_at",
        "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    `,
      [
        masterEmployee.EMP_ID,
        passwordHash,
        usergroup,
        groupno,
        build,
        manage,
        tools,
        masterEmployee.EMP_EMAIL_ID || cleanEmail,
        pageaccess,
        active,
        verifiedReportingTo,
      ]
    )

    // 5b. If elevated role requested, create a formal access request
    if (isElevatedRequest) {
      await client.query(
        `
        INSERT INTO "ACCESS_REQUESTS" ("username", "requested_role", "status", "reason", "requested_at")
        VALUES ($1, $2, 'PENDING', $3, NOW())
      `,
        [masterEmployee.EMP_ID, requestedRole, `Registration elevation request for ${requestedRole} access`]
      )
    }

    // 6. Audit logging (excluding sensitive credentials)
    console.log(
      JSON.stringify({
        event: "USER_REGISTRATION_REQUESTED",
        timestamp: new Date().toISOString(),
        staffNo: masterEmployee.EMP_ID,
        requestedRole,
        effectiveRole,
        accountStatus: status,
        sourceIp: params.clientIP || "unknown",
        result: "SUCCESS",
      })
    )

    // Also persist to audit logs table
    try {
      await client.query(
        `
        INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [
          "USER_REGISTRATION_REQUESTED",
          "USER",
          masterEmployee.EMP_ID,
          masterEmployee.EMP_ID,
          JSON.stringify({ requestedRole, effectiveRole, accountStatus: status }),
          params.clientIP || "unknown",
        ]
      )
    } catch {
      // Non-critical audit insertion failure
    }

    return {
      success: true,
      staffNo: masterEmployee.EMP_ID,
      status,
      requestedRole,
      effectiveRole,
      message:
        status === "ACTIVE"
          ? "Your BHEL Transport Portal account has been created successfully."
          : "Your account registration has been submitted. Elevated access is pending administrative authorization.",
    }
  })
}

/**
 * ============================================================================
 * ADMINISTRATIVE DASHBOARD DATABASE OPERATIONS
 * ============================================================================
 */

export interface AdminStats {
  totalEmployees: number
  registeredAccounts: number
  activeAccounts: number
  pendingRegistrations: number
  pendingRoleRequests: number
  recentAudits: Array<{
    id: number
    action: string
    target_id: string
    actor: string
    details: Record<string, unknown>
    created_at: string
  }>
}

/**
 * Get aggregated KPI metrics for the Admin Dashboard
 */
export async function getAdminDashboardStats(): Promise<AdminStats> {
  try {
    const empRes = await query(`SELECT COUNT(*) as count FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW" WHERE "ACTIVE" = '1' OR "ACTIVE" IS NULL`)
    const userRes = await query(`SELECT COUNT(*) as count FROM "axusers"`)
    const activeRes = await query(`SELECT COUNT(*) as count FROM "axusers" WHERE "active" = '1'`)
    const pendingRegRes = await query(`SELECT COUNT(*) as count FROM "axusers" WHERE "active" = '0' OR "active" IS NULL`)
    
    let pendingRoleRequests = 0
    try {
      const roleReqRes = await query(`SELECT COUNT(*) as count FROM "ACCESS_REQUESTS" WHERE "status" = 'PENDING'`)
      pendingRoleRequests = parseInt(roleReqRes.rows[0]?.count || "0", 10)
    } catch {
      pendingRoleRequests = 0
    }

    let recentAudits: AdminStats["recentAudits"] = []
    try {
      const auditRes = await query(
        `SELECT "id", "action", "target_id", "actor", "details", "created_at" FROM "ADMIN_AUDIT_LOGS" ORDER BY "created_at" DESC LIMIT 10`
      )
      recentAudits = auditRes.rows.map((r) => ({
        id: r.id,
        action: r.action,
        target_id: r.target_id,
        actor: r.actor,
        details: typeof r.details === "string" ? JSON.parse(r.details) : r.details || {},
        created_at: r.created_at,
      }))
    } catch {
      recentAudits = []
    }

    return {
      totalEmployees: parseInt(empRes.rows[0]?.count || "0", 10),
      registeredAccounts: parseInt(userRes.rows[0]?.count || "0", 10),
      activeAccounts: parseInt(activeRes.rows[0]?.count || "0", 10),
      pendingRegistrations: parseInt(pendingRegRes.rows[0]?.count || "0", 10),
      pendingRoleRequests,
      recentAudits,
    }
  } catch (error) {
    console.error("getAdminDashboardStats error:", error)
    throw error
  }
}

export interface AdminEmployeeItem {
  empId: string
  firstName: string
  middleName?: string
  lastName: string
  fullName: string
  designation: string
  email: string
  department: string
  active: string
  hasAccount: boolean
  accountActive: boolean
  usergroup?: string
}

/**
 * Retrieve master employee directory with attached portal account status
 */
export async function getEmployeeMasterList(params?: {
  search?: string
  department?: string
  limit?: number
  offset?: number
}): Promise<{ employees: AdminEmployeeItem[]; total: number }> {
  try {
    const search = params?.search?.trim() || ""
    const department = params?.department?.trim() || ""
    const limit = params?.limit || 50
    const offset = params?.offset || 0

    let queryText = `
      SELECT 
        e."EMP_ID",
        e."EMP_FNAME",
        e."EMP_MNAME",
        e."EMP_LNAME",
        e."EMP_DESIGNATION",
        e."EMP_EMAIL_ID",
        e."DEPT",
        COALESCE(e."ACTIVE", '1') as "ACTIVE",
        u."username" as "account_username",
        u."active" as "account_active",
        u."usergroup" as "account_usergroup"
      FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW" e
      LEFT JOIN "axusers" u ON LOWER(TRIM(u."username")) = LOWER(TRIM(e."EMP_ID"))
      WHERE 1=1
    `
    const queryParams: unknown[] = []
    let pIdx = 1

    if (search) {
      queryText += ` AND (
        LOWER(e."EMP_ID") LIKE $${pIdx} OR 
        LOWER(e."EMP_FNAME") LIKE $${pIdx} OR 
        LOWER(e."EMP_LNAME") LIKE $${pIdx} OR 
        LOWER(e."EMP_EMAIL_ID") LIKE $${pIdx}
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      pIdx++
    }

    if (department && department !== "ALL") {
      queryText += ` AND LOWER(e."DEPT") = $${pIdx}`
      queryParams.push(department.toLowerCase())
      pIdx++
    }

    queryText += ` ORDER BY e."EMP_ID" ASC LIMIT $${pIdx} OFFSET $${pIdx + 1}`
    queryParams.push(limit, offset)

    const res = await query(queryText, queryParams)

    const employees: AdminEmployeeItem[] = res.rows.map((r) => {
      const nameParts = [r.EMP_FNAME, r.EMP_MNAME, r.EMP_LNAME].filter((p: string) => p && p.trim())
      const fullName = nameParts.join(" ") || r.EMP_FNAME || r.EMP_ID
      return {
        empId: r.EMP_ID,
        firstName: r.EMP_FNAME || "",
        middleName: r.EMP_MNAME || "",
        lastName: r.EMP_LNAME || "",
        fullName,
        designation: r.EMP_DESIGNATION || "",
        email: r.EMP_EMAIL_ID || "",
        department: r.DEPT || "General",
        active: r.ACTIVE || "1",
        hasAccount: !!r.account_username,
        accountActive: r.account_active === "1",
        usergroup: r.account_usergroup || undefined,
      }
    })

    return {
      employees,
      total: employees.length,
    }
  } catch (error) {
    console.error("getEmployeeMasterList error:", error)
    throw error
  }
}

/**
 * Add a new employee to the authoritative Master Directory
 */
export async function addEmployeeMaster(
  data: {
    empId: string
    firstName: string
    middleName?: string
    lastName: string
    designation: string
    email: string
    department: string
  },
  actor: string,
  clientIP?: string
): Promise<MasterEmployee> {
  const cleanId = data.empId.trim()
  const cleanEmail = data.email.trim().toLowerCase()

  // 1. Check for duplicates
  const existing = await query(
    `SELECT "EMP_ID" FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW" WHERE LOWER(TRIM("EMP_ID")) = LOWER($1) OR LOWER(TRIM("EMP_EMAIL_ID")) = $2`,
    [cleanId, cleanEmail]
  )

  if (existing.rows.length > 0) {
    throw new Error("EMPLOYEE_ALREADY_EXISTS")
  }

  // 2. Insert into Master Directory table
  await query(
    `
    INSERT INTO "EDN_PIS_EMPLOYEE_MASTER_VIEW" (
      "EMP_ID", "EMP_FNAME", "EMP_MNAME", "EMP_LNAME", "EMP_DESIGNATION", "EMP_EMAIL_ID", "DEPT", "ACTIVE"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, '1')
  `,
    [
      cleanId,
      data.firstName.trim(),
      data.middleName?.trim() || null,
      data.lastName.trim(),
      data.designation.trim(),
      cleanEmail,
      data.department.trim(),
    ]
  )

  // 3. Log Audit Event
  await logAdminAuditEvent(
    "ADMIN_EMPLOYEE_CREATED",
    "EMPLOYEE",
    cleanId,
    actor,
    {
      empId: cleanId,
      fullName: `${data.firstName} ${data.lastName}`.trim(),
      department: data.department,
      designation: data.designation,
      email: cleanEmail,
    },
    clientIP
  )

  const nameParts = [data.firstName, data.middleName, data.lastName].filter((p) => p && p.trim())
  return {
    empId: cleanId,
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    designation: data.designation,
    email: cleanEmail,
    department: data.department,
    fullName: nameParts.join(" "),
  }
}

/**
 * Update an existing employee in the Master Directory
 */
export async function updateEmployeeMaster(
  empId: string,
  data: {
    firstName: string
    middleName?: string
    lastName: string
    designation: string
    email: string
    department: string
  },
  actor: string,
  clientIP?: string
): Promise<void> {
  const cleanId = empId.trim()
  const cleanEmail = data.email.trim().toLowerCase()

  await query(
    `
    UPDATE "EDN_PIS_EMPLOYEE_MASTER_VIEW" SET
      "EMP_FNAME" = $1,
      "EMP_MNAME" = $2,
      "EMP_LNAME" = $3,
      "EMP_DESIGNATION" = $4,
      "EMP_EMAIL_ID" = $5,
      "DEPT" = $6
    WHERE "EMP_ID" = $7
  `,
    [
      data.firstName.trim(),
      data.middleName?.trim() || null,
      data.lastName.trim(),
      data.designation.trim(),
      cleanEmail,
      data.department.trim(),
      cleanId,
    ]
  )

  await logAdminAuditEvent(
    "ADMIN_EMPLOYEE_UPDATED",
    "EMPLOYEE",
    cleanId,
    actor,
    { empId: cleanId, updatedFields: data },
    clientIP
  )
}

/**
 * Soft lifecycle management: Activate or Deactivate/Retire employee
 */
export async function setEmployeeMasterStatus(
  empId: string,
  active: "0" | "1",
  actor: string,
  clientIP?: string
): Promise<void> {
  const cleanId = empId.trim()

  await withTransaction(async (client) => {
    // 1. Update master table active flag
    await client.query(`UPDATE "EDN_PIS_EMPLOYEE_MASTER_VIEW" SET "ACTIVE" = $1 WHERE "EMP_ID" = $2`, [active, cleanId])

    // 2. If deactivating, also deactivate corresponding portal account
    if (active === "0") {
      await client.query(`UPDATE "axusers" SET "active" = '0', "updated_at" = NOW() WHERE "username" = $1`, [cleanId])
    }

    // 3. Log Audit
    await client.query(
      `
      INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [
        "ADMIN_EMPLOYEE_STATUS_CHANGED",
        "EMPLOYEE",
        cleanId,
        actor,
        JSON.stringify({ active, status: active === "1" ? "ACTIVE" : "RETIRED" }),
        clientIP || "unknown",
      ]
    )
  })
}

/**
 * Retrieve all registered portal user accounts
 */
export async function getRegisteredUsersList(params?: {
  search?: string
  role?: string
  status?: string
}): Promise<DBUser[]> {
  try {
    let queryText = `
      SELECT 
        "username", "usergroup", "groupno", "build", "manage", "tools", "email", "pageaccess", "active", "Reportingto"
      FROM "axusers"
      WHERE 1=1
    `
    const queryParams: unknown[] = []
    let pIdx = 1

    if (params?.search) {
      queryText += ` AND (LOWER("username") LIKE $${pIdx} OR LOWER("email") LIKE $${pIdx} OR LOWER("usergroup") LIKE $${pIdx})`
      queryParams.push(`%${params.search.toLowerCase()}%`)
      pIdx++
    }

    if (params?.role && params.role !== "ALL") {
      queryText += ` AND LOWER("usergroup") = $${pIdx}`
      queryParams.push(params.role.toLowerCase())
      pIdx++
    }

    if (params?.status && params.status !== "ALL") {
      queryText += ` AND "active" = $${pIdx}`
      queryParams.push(params.status)
      pIdx++
    }

    queryText += ` ORDER BY "username" ASC`
    const res = await query(queryText, queryParams)
    return res.rows as DBUser[]
  } catch (error) {
    console.error("getRegisteredUsersList error:", error)
    throw error
  }
}

/**
 * Toggle portal user active status
 */
export async function setUserAccountStatus(
  username: string,
  active: "0" | "1",
  actor: string,
  clientIP?: string
): Promise<void> {
  const cleanUsername = username.trim()

  await query(`UPDATE "axusers" SET "active" = $1, "updated_at" = NOW() WHERE "username" = $2`, [active, cleanUsername])

  await logAdminAuditEvent(
    "ADMIN_USER_STATUS_UPDATED",
    "USER",
    cleanUsername,
    actor,
    { username: cleanUsername, active, status: active === "1" ? "ACTIVE" : "INACTIVE" },
    clientIP
  )
}

export interface AccessRequestItem {
  id: number
  username: string
  requestedRole: string
  status: string
  reason?: string
  requestedAt: string
  reviewedAt?: string
  reviewedBy?: string
  employeeName: string
  department: string
  designation: string
  email: string
}

/**
 * Retrieve pending role and access elevation requests
 */
export async function getPendingAccessRequests(): Promise<AccessRequestItem[]> {
  try {
    const res = await query(`
      SELECT 
        r."id",
        r."username",
        r."requested_role",
        r."status",
        r."reason",
        r."requested_at",
        r."reviewed_at",
        r."reviewed_by",
        e."EMP_FNAME",
        e."EMP_MNAME",
        e."EMP_LNAME",
        e."DEPT",
        e."EMP_DESIGNATION",
        e."EMP_EMAIL_ID"
      FROM "ACCESS_REQUESTS" r
      LEFT JOIN "EDN_PIS_EMPLOYEE_MASTER_VIEW" e ON LOWER(TRIM(e."EMP_ID")) = LOWER(TRIM(r."username"))
      WHERE r."status" = 'PENDING'
      ORDER BY r."requested_at" ASC
    `)

    return res.rows.map((r) => {
      const nameParts = [r.EMP_FNAME, r.EMP_MNAME, r.EMP_LNAME].filter((p: string) => p && p.trim())
      return {
        id: r.id,
        username: r.username,
        requestedRole: r.requested_role,
        status: r.status,
        reason: r.reason,
        requestedAt: r.requested_at,
        reviewedAt: r.reviewed_at,
        reviewedBy: r.reviewed_by,
        employeeName: nameParts.join(" ") || r.EMP_FNAME || r.username,
        department: r.DEPT || "General",
        designation: r.EMP_DESIGNATION || "Staff",
        email: r.EMP_EMAIL_ID || "",
      }
    })
  } catch (error) {
    console.error("getPendingAccessRequests error:", error)
    return []
  }
}

/**
 * Transactional approval of a role access request
 */
export async function approveAccessRequest(
  requestId: number,
  actor: string,
  clientIP?: string
): Promise<{ success: boolean; username: string; approvedRole: string }> {
  return await withTransaction(async (client) => {
    // 1. Lock and fetch request row
    const reqRes = await client.query(`SELECT * FROM "ACCESS_REQUESTS" WHERE "id" = $1 FOR UPDATE`, [requestId])

    if (reqRes.rows.length === 0) {
      throw new Error("REQUEST_NOT_FOUND")
    }

    const request = reqRes.rows[0]
    if (request.status !== "PENDING") {
      throw new Error("REQUEST_ALREADY_PROCESSED")
    }

    const targetRole = (request.requested_role || "employee").toLowerCase()

    // 2. Map strictly to server-owned RBAC policy
    let usergroup = "Employee"
    let manage = "0"
    let build = "0"
    let tools = "0"
    let pageaccess = "employee"
    let groupno = "EMP01"

    if (targetRole === "manager") {
      usergroup = "Manager"
      manage = "1"
      build = "1"
      tools = "0"
      pageaccess = "manager"
      groupno = "MGR01"
    } else if (targetRole === "transport") {
      usergroup = "Transport"
      manage = "0"
      build = "0"
      tools = "1"
      pageaccess = "transport"
      groupno = "TRN01"
    }

    // 3. Update axusers permissions and activate account
    await client.query(
      `
      UPDATE "axusers" SET
        "usergroup" = $1,
        "groupno" = $2,
        "build" = $3,
        "manage" = $4,
        "tools" = $5,
        "pageaccess" = $6,
        "active" = '1',
        "updated_at" = NOW()
      WHERE "username" = $7
    `,
      [usergroup, groupno, build, manage, tools, pageaccess, request.username]
    )

    // 4. Update request status
    await client.query(
      `
      UPDATE "ACCESS_REQUESTS" SET
        "status" = 'APPROVED',
        "reviewed_at" = NOW(),
        "reviewed_by" = $1
      WHERE "id" = $2
    `,
      [actor, requestId]
    )

    // 5. Append-only Audit Log
    await client.query(
      `
      INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [
        "ADMIN_ROLE_APPROVED",
        "USER",
        request.username,
        actor,
        JSON.stringify({ requestId, requestedRole: targetRole, approvedRole: usergroup, permissions: { manage, build, tools } }),
        clientIP || "unknown",
      ]
    )

    return {
      success: true,
      username: request.username,
      approvedRole: usergroup,
    }
  })
}

/**
 * Transactional rejection of a role access request (defaults user to standard active Employee)
 */
export async function rejectAccessRequest(
  requestId: number,
  reason: string,
  actor: string,
  clientIP?: string
): Promise<{ success: boolean; username: string }> {
  return await withTransaction(async (client) => {
    const reqRes = await client.query(`SELECT * FROM "ACCESS_REQUESTS" WHERE "id" = $1 FOR UPDATE`, [requestId])

    if (reqRes.rows.length === 0) {
      throw new Error("REQUEST_NOT_FOUND")
    }

    const request = reqRes.rows[0]

    // Update request status to REJECTED
    await client.query(
      `
      UPDATE "ACCESS_REQUESTS" SET
        "status" = 'REJECTED',
        "review_notes" = $1,
        "reviewed_at" = NOW(),
        "reviewed_by" = $2
      WHERE "id" = $3
    `,
      [reason || "Denied by Administrator", actor, requestId]
    )

    // Ensure account remains a safe standard Employee and set active to 1
    await client.query(
      `
      UPDATE "axusers" SET
        "usergroup" = 'Employee',
        "manage" = '0',
        "build" = '0',
        "tools" = '0',
        "active" = '1',
        "updated_at" = NOW()
      WHERE "username" = $1
    `,
      [request.username]
    )

    // Audit log
    await client.query(
      `
      INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [
        "ADMIN_ROLE_REJECTED",
        "USER",
        request.username,
        actor,
        JSON.stringify({ requestId, reason, defaultRole: "Employee" }),
        clientIP || "unknown",
      ]
    )

    return {
      success: true,
      username: request.username,
    }
  })
}

/**
 * Retrieve chronological append-only audit logs
 */
export async function getAdminAuditLogs(limit = 50): Promise<Array<{
  id: number
  action: string
  target_type: string
  target_id: string
  actor: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}>> {
  try {
    const res = await query(`
      SELECT "id", "action", "target_type", "target_id", "actor", "details", "ip_address", "created_at"
      FROM "ADMIN_AUDIT_LOGS"
      ORDER BY "created_at" DESC
      LIMIT $1
    `, [limit])

    return res.rows.map((r) => ({
      id: r.id,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      actor: r.actor,
      details: typeof r.details === "string" ? JSON.parse(r.details) : r.details || {},
      ip_address: r.ip_address,
      created_at: r.created_at,
    }))
  } catch (error) {
    console.error("getAdminAuditLogs error:", error)
    return []
  }
}

/**
 * Log structured audit event
 */
export async function logAdminAuditEvent(
  action: string,
  targetType: string,
  targetId: string,
  actor: string,
  details: Record<string, unknown>,
  ipAddress = "unknown"
): Promise<void> {
  try {
    await query(
      `
      INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
      [action, targetType, targetId, actor, JSON.stringify(details), ipAddress]
    )
  } catch (err) {
    console.warn("Failed to write to ADMIN_AUDIT_LOGS table:", err)
  }
}


