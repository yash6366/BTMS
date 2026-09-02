import bcrypt from "bcryptjs"
import crypto from "crypto"
import { query, withTransaction, DBUser } from "./database"
import { resolveUserRole, resolvePermissions } from "./secure-auth"
import type { UserRole } from "@/types"

export interface UpdateUserAdminPayload {
  role?: UserRole
  build?: boolean
  manage?: boolean
  tools?: boolean
  reportingTo?: string | null
  active?: boolean
}

export interface UserAdminAuditDetails {
  actor: string
  target: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changed?: Record<string, { from: unknown; to: unknown }>
  reason?: string
}

/**
 * Server-Side Admin Authorization & User Service Boundary
 * Enforces:
 * 1. Self-lockout prevention (admin cannot deactivate, demote, or strip own access)
 * 2. Last-admin protection (system cannot be left with 0 active administrators)
 * 3. Canonical role precedence over permission overrides
 * 4. Transactional state mutation with comprehensive structured before/after audit trail
 */
export class AdminUserService {
  /**
   * Count the number of active system administrators currently in the system
   */
  static async getActiveAdminCount(): Promise<number> {
    const res = await query(`
      SELECT COUNT(*) as count 
      FROM "axusers" 
      WHERE ("usergroup" ILIKE '%admin%' OR "pageaccess" ILIKE '%admin%' OR "username" = 'admin')
        AND "active" = '1'
    `)
    return parseInt(res.rows[0]?.count || "0", 10)
  }

  /**
   * Get list of eligible managers for Reporting-To assignment
   */
  static async getEligibleManagers(): Promise<Array<{ username: string; fullName: string; department?: string }>> {
    const res = await query(`
      SELECT 
        u."username",
        COALESCE(
          NULLIF(TRIM(CONCAT(e."EMP_FNAME", ' ', e."EMP_MNAME", ' ', e."EMP_LNAME")), ''),
          e."EMP_FNAME",
          u."username"
        ) as "fullName",
        e."DEPT" as "department"
      FROM "axusers" u
      LEFT JOIN "EDN_PIS_EMPLOYEE_MASTER_VIEW" e ON LOWER(TRIM(e."EMP_ID")) = LOWER(TRIM(u."username"))
      WHERE (u."manage" = '1' OR u."usergroup" ILIKE '%manager%' OR u."usergroup" ILIKE '%admin%')
        AND u."active" = '1'
      ORDER BY "fullName" ASC
    `)

    return res.rows.map((r) => ({
      username: r.username,
      fullName: r.fullName || r.username,
      department: r.department || undefined,
    }))
  }

  /**
   * Authoritative user account update with safety invariants and audit logging
   */
  static async updateUser(
    targetUsername: string,
    updates: UpdateUserAdminPayload,
    actorUsername: string,
    clientIP = "unknown"
  ): Promise<{ success: boolean; message: string; updatedUser: Partial<DBUser> }> {
    const cleanTarget = targetUsername.trim()
    const cleanActor = actorUsername.trim()
    const isSelf = cleanTarget.toLowerCase() === cleanActor.toLowerCase()

    return await withTransaction(async (client) => {
      // 1. Lock and fetch current target user state
      const userRes = await client.query(`SELECT * FROM "axusers" WHERE LOWER(TRIM("username")) = LOWER($1) FOR UPDATE`, [
        cleanTarget,
      ])

      if (userRes.rows.length === 0) {
        throw new Error("USER_NOT_FOUND")
      }

      const currentUser = userRes.rows[0] as DBUser
      const currentRole = resolveUserRole({
        username: currentUser.username,
        usergroup: currentUser.usergroup,
        pageaccess: currentUser.pageaccess,
        manage: currentUser.manage,
        tools: currentUser.tools,
      })

      const isTargetActiveAdmin = currentRole === "admin" && currentUser.active === "1"

      // 2. Invariant Check: Self-Lockout Protection
      if (isSelf) {
        if (updates.active === false) {
          throw new Error("CANNOT_DEACTIVATE_SELF: Administrators cannot deactivate their own account.")
        }
        if (updates.role && updates.role !== "admin") {
          throw new Error("CANNOT_DEMOTE_SELF: Administrators cannot revoke their own administrator role.")
        }
      }

      // 3. Invariant Check: Last Active Administrator Protection
      if (isTargetActiveAdmin) {
        const willBeInactive = updates.active === false
        const willBeDemoted = updates.role && updates.role !== "admin"

        if (willBeInactive || willBeDemoted) {
          // Check count within transaction
          const countRes = await client.query(`
            SELECT COUNT(*) as count 
            FROM "axusers" 
            WHERE ("usergroup" ILIKE '%admin%' OR "pageaccess" ILIKE '%admin%' OR "username" = 'admin')
              AND "active" = '1'
          `)
          const activeAdmins = parseInt(countRes.rows[0]?.count || "0", 10)

          if (activeAdmins <= 1) {
            throw new Error("CANNOT_REMOVE_LAST_ADMIN: System requires at least one active administrator.")
          }
        }
      }

      // 4. Resolve Target Role & Permissions
      const newRole: UserRole = updates.role || currentRole

      // Derive baseline permissions from the authoritative role
      const effectivePerms = resolvePermissions(
        {
          build: updates.build !== undefined ? updates.build : currentUser.build,
          manage: updates.manage !== undefined ? updates.manage : currentUser.manage,
          tools: updates.tools !== undefined ? updates.tools : currentUser.tools,
        },
        newRole
      )

      // Map canonical role to usergroup, groupno, pageaccess
      let usergroup = currentUser.usergroup || "Employee"
      let groupno = currentUser.groupno || "EMP01"
      let pageaccess = currentUser.pageaccess || "employee"

      if (newRole === "admin") {
        usergroup = "Admin"
        groupno = "ADM01"
        pageaccess = "admin"
      } else if (newRole === "manager") {
        usergroup = "Manager"
        groupno = "MGR01"
        pageaccess = "manager"
      } else if (newRole === "transport") {
        usergroup = "Transport"
        groupno = "TRN01"
        pageaccess = "transport"
      } else if (newRole === "employee") {
        usergroup = "Employee"
        groupno = "EMP01"
        pageaccess = "employee"
      }

      const newActive = updates.active !== undefined ? (updates.active ? "1" : "0") : currentUser.active || "1"
      const newReportingTo = updates.reportingTo !== undefined ? updates.reportingTo : currentUser.Reportingto

      const buildFlag = effectivePerms.build ? "1" : "0"
      const manageFlag = effectivePerms.manage ? "1" : "0"
      const toolsFlag = effectivePerms.tools ? "1" : "0"

      // 5. Execute DB Update
      await client.query(
        `
        UPDATE "axusers" SET
          "usergroup" = $1,
          "groupno" = $2,
          "pageaccess" = $3,
          "build" = $4,
          "manage" = $5,
          "tools" = $6,
          "active" = $7,
          "Reportingto" = $8,
          "updated_at" = NOW()
        WHERE LOWER(TRIM("username")) = LOWER($9)
      `,
        [usergroup, groupno, pageaccess, buildFlag, manageFlag, toolsFlag, newActive, newReportingTo, cleanTarget]
      )

      // 6. Record Audit Logs with Structured Before/After Diffs
      // a) Role update audit
      if (currentRole !== newRole) {
        await client.query(
          `
          INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
          [
            "ADMIN_ROLE_UPDATED",
            "USER",
            cleanTarget,
            cleanActor,
            JSON.stringify({
              before: { role: currentRole, usergroup: currentUser.usergroup },
              after: { role: newRole, usergroup },
              isPromotionToAdmin: newRole === "admin",
            }),
            clientIP,
          ]
        )
      }

      // b) Permission update audit
      const permChanges: Record<string, { from: boolean; to: boolean }> = {}
      if ((currentUser.build === "1") !== effectivePerms.build) permChanges.build = { from: currentUser.build === "1", to: effectivePerms.build }
      if ((currentUser.manage === "1") !== effectivePerms.manage) permChanges.manage = { from: currentUser.manage === "1", to: effectivePerms.manage }
      if ((currentUser.tools === "1") !== effectivePerms.tools) permChanges.tools = { from: currentUser.tools === "1", to: effectivePerms.tools }

      if (Object.keys(permChanges).length > 0) {
        await client.query(
          `
          INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
          [
            "ADMIN_PERMISSIONS_UPDATED",
            "USER",
            cleanTarget,
            cleanActor,
            JSON.stringify({ changed: permChanges, role: newRole }),
            clientIP,
          ]
        )
      }

      // c) Status update audit
      if (currentUser.active !== newActive) {
        await client.query(
          `
          INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
          [
            "ADMIN_USER_STATUS_UPDATED",
            "USER",
            cleanTarget,
            cleanActor,
            JSON.stringify({
              before: { active: currentUser.active },
              after: { active: newActive },
              status: newActive === "1" ? "ACTIVE" : "DISABLED",
            }),
            clientIP,
          ]
        )
      }

      // d) Reporting manager update audit
      if (currentUser.Reportingto !== newReportingTo) {
        await client.query(
          `
          INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
          [
            "ADMIN_USER_REPORTING_UPDATED",
            "USER",
            cleanTarget,
            cleanActor,
            JSON.stringify({
              before: { reportingTo: currentUser.Reportingto || null },
              after: { reportingTo: newReportingTo || null },
            }),
            clientIP,
          ]
        )
      }

      return {
        success: true,
        message: `User account ${cleanTarget} updated successfully.`,
        updatedUser: {
          username: cleanTarget,
          usergroup,
          build: buildFlag,
          manage: manageFlag,
          tools: toolsFlag,
          active: newActive,
          Reportingto: newReportingTo || undefined,
        },
      }
    })
  }

  /**
   * Reset user password with cryptographically secure temporary password
   * Invariants:
   * - Enforces forcePasswordChange (must_change_password = true)
   * - Temporary password generated, bcrypt-hashed, and returned ONCE in memory
   * - NEVER logged, persisted in plaintext, or exposed in audit trails
   */
  static async resetUserPassword(
    targetUsername: string,
    actorUsername: string,
    clientIP = "unknown"
  ): Promise<{ success: boolean; temporaryPassword: string; message: string }> {
    const cleanTarget = targetUsername.trim()
    const cleanActor = actorUsername.trim()

    // 1. Generate secure high-entropy temporary password
    const rawEntropy = crypto.randomBytes(6).toString("hex") // 12 chars
    const tempPassword = `Bhel#${rawEntropy}`

    // 2. Hash with bcrypt (salt rounds = 10)
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(tempPassword, salt)

    await withTransaction(async (client) => {
      // 3. Verify user exists
      const userRes = await client.query(`SELECT "username" FROM "axusers" WHERE LOWER(TRIM("username")) = LOWER($1) FOR UPDATE`, [
        cleanTarget,
      ])

      if (userRes.rows.length === 0) {
        throw new Error("USER_NOT_FOUND")
      }

      // 4. Update password hash and set must_change_password = true
      await client.query(
        `
        UPDATE "axusers" SET
          "password_hash" = $1,
          "password" = NULL,
          "pwd" = NULL,
          "hashed_password" = NULL,
          "must_change_password" = TRUE,
          "updated_at" = NOW()
        WHERE LOWER(TRIM("username")) = LOWER($2)
      `,
        [passwordHash, cleanTarget]
      )

      // 5. Append-only Audit Log (NEVER includes the password!)
      await client.query(
        `
        INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [
          "ADMIN_PASSWORD_RESET",
          "USER",
          cleanTarget,
          cleanActor,
          JSON.stringify({ forcedChange: true }),
          clientIP,
        ]
      )
    })

    return {
      success: true,
      temporaryPassword: tempPassword,
      message: `Password reset successfully for ${cleanTarget}. Provide the temporary credential to the user; they will be required to change it on login.`,
    }
  }

  /**
   * Provision a brand-new portal account directly from Employee Master record
   */
  static async provisionUserAccount(
    empId: string,
    role: UserRole = "employee",
    actorUsername: string,
    clientIP = "unknown"
  ): Promise<{ success: boolean; username: string; temporaryPassword: string; message: string }> {
    const cleanId = empId.trim()
    const cleanActor = actorUsername.trim()

    return await withTransaction(async (client) => {
      // 1. Verify employee exists in master view
      const masterRes = await client.query(
        `SELECT * FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW" WHERE LOWER(TRIM("EMP_ID")) = LOWER($1)`,
        [cleanId]
      )

      if (masterRes.rows.length === 0) {
        throw new Error("EMPLOYEE_NOT_IN_MASTER: Staff ID is not in Employee Master Directory.")
      }

      const emp = masterRes.rows[0]

      // 2. Check if already has an axusers account
      const userRes = await client.query(
        `SELECT "username" FROM "axusers" WHERE LOWER(TRIM("username")) = LOWER($1)`,
        [cleanId]
      )

      if (userRes.rows.length > 0) {
        throw new Error("ACCOUNT_ALREADY_EXISTS: A portal user account already exists for this Staff ID.")
      }

      // 3. Resolve role attributes & permissions
      const perms = resolvePermissions({}, role)
      let usergroup = "Employee"
      let groupno = "EMP01"
      let pageaccess = "employee"

      if (role === "admin") {
        usergroup = "Admin"
        groupno = "ADM01"
        pageaccess = "admin"
      } else if (role === "manager") {
        usergroup = "Manager"
        groupno = "MGR01"
        pageaccess = "manager"
      } else if (role === "transport") {
        usergroup = "Transport"
        groupno = "TRN01"
        pageaccess = "transport"
      }

      // 4. Generate temporary credentials
      const rawEntropy = crypto.randomBytes(6).toString("hex")
      const tempPassword = `Bhel#${rawEntropy}`
      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(tempPassword, salt)

      // 5. Insert account
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
          "must_change_password",
          "created_at",
          "updated_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '1', TRUE, NOW(), NOW())
      `,
        [
          cleanId,
          passwordHash,
          usergroup,
          groupno,
          perms.build ? "1" : "0",
          perms.manage ? "1" : "0",
          perms.tools ? "1" : "0",
          emp.EMP_EMAIL_ID || null,
          pageaccess,
        ]
      )

      // 6. Record structured audit log
      await client.query(
        `
        INSERT INTO "ADMIN_AUDIT_LOGS" ("action", "target_type", "target_id", "actor", "details", "ip_address", "created_at")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [
          "ADMIN_USER_PROVISIONED",
          "USER",
          cleanId,
          cleanActor,
          JSON.stringify({ role, usergroup, email: emp.EMP_EMAIL_ID }),
          clientIP,
        ]
      )

      return {
        success: true,
        username: cleanId,
        temporaryPassword: tempPassword,
        message: `Account for ${cleanId} successfully provisioned as ${role}. Temporary password generated.`,
      }
    })
  }
}
