import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import crypto from "crypto"

// Security configuration
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production")
    }
    return new TextEncoder().encode("development-secret-key-change-in-production")
  }
  
  return new TextEncoder().encode(secret)
}

const JWT_SECRET = getJWTSecret()

import type { UserRole } from "@/types"

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h"
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d"

// Input representation for authoritative role resolution
export interface UserRoleResolutionInput {
  username?: string
  usergroup?: string
  pageaccess?: string
  role?: string
  manage?: string | boolean
  tools?: string | boolean
  build?: string | boolean
  usertype?: string
}

/**
 * Authoritative Canonical Role Resolver
 * Strict Hierarchy: ADMIN -> MANAGER -> TRANSPORT -> EMPLOYEE
 * Guarantees identical role resolution across all authentication and operational routes.
 */
export function resolveUserRole(user: UserRoleResolutionInput): UserRole {
  // If explicitly assigned a valid canonical UserRole, honor it
  if (user.role === "admin" || user.role === "manager" || user.role === "transport" || user.role === "employee") {
    return user.role
  }

  const usergroup = (user.usergroup || "").toLowerCase().trim()
  const pageaccess = (user.pageaccess || "").toLowerCase().trim()
  const username = (user.username || "").toLowerCase().trim()

  // 1. ADMIN - Highest Priority
  // Authoritative admin markers: usergroup or pageaccess contains 'admin'
  // Or known legacy administration accounts (e.g. system 'admin')
  if (usergroup.includes("admin") || pageaccess.includes("admin") || username === "admin") {
    return "admin"
  }

  // 2. MANAGER - Second Priority
  // Authoritative manager markers: usergroup contains 'manager', pageaccess contains 'manager', manage flag set
  if (
    usergroup.includes("manager") ||
    pageaccess.includes("manager") ||
    user.manage === "1" ||
    user.manage === "Y" ||
    user.manage === true
  ) {
    return "manager"
  }

  // 3. TRANSPORT - Third Priority
  // Authoritative transport markers: usergroup contains 'transport', pageaccess contains 'transport', usertype is 'transport'
  if (
    usergroup.includes("transport") ||
    pageaccess.includes("transport") ||
    user.usertype === "transport" ||
    user.tools === "1" ||
    user.tools === "Y" ||
    user.tools === true
  ) {
    return "transport"
  }

  // 4. EMPLOYEE - Default
  return "employee"
}

/**
 * Authoritative Permission Resolver
 * Separates role from permissions:
 * 1. Derives baseline permissions from canonical role.
 * 2. Allows optional explicit overrides without corrupting the authoritative role.
 */
export function resolvePermissions(
  user: { build?: string | boolean; manage?: string | boolean; tools?: string | boolean },
  role: UserRole
): { build: boolean; manage: boolean; tools: boolean } {
  // 1. Role-derived baseline permissions
  const baseline: Record<UserRole, { build: boolean; manage: boolean; tools: boolean }> = {
    admin: { build: true, manage: true, tools: true },
    manager: { build: true, manage: true, tools: false },
    transport: { build: false, manage: false, tools: true },
    employee: { build: false, manage: false, tools: false },
  }

  const effective = { ...baseline[role] }

  // 2. Optional explicit overrides from DB record flags if explicitly provided
  if (user.build !== undefined && user.build !== null) {
    effective.build = user.build === "1" || user.build === "Y" || user.build === true
  }
  if (user.manage !== undefined && user.manage !== null) {
    effective.manage = user.manage === "1" || user.manage === "Y" || user.manage === true
  }
  if (user.tools !== undefined && user.tools !== null) {
    effective.tools = user.tools === "1" || user.tools === "Y" || user.tools === true
  }

  // Administrators always have full system privileges
  if (role === "admin") {
    effective.build = true
    effective.manage = true
    effective.tools = true
  }

  return effective
}

// Token interfaces
export interface TokenPayload {
  username: string
  usergroup: string
  email?: string
  role: UserRole
  usertype?: string
  permissions: {
    build: boolean
    manage: boolean
    tools: boolean
  }
  iat: number
  exp: number
  jti: string
  sessionId: string
  type?: "access" | "refresh"
}

export interface AuthUser {
  username: string
  usergroup: string
  email?: string
  role: UserRole
  usertype?: string
  permissions: {
    build: boolean
    manage: boolean
    tools: boolean
  }
}

// Generate secure random token
function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString("hex")
}

// Create JWT token with enhanced security and canonical role/permission resolution
export async function createSecureToken(user: {
  username: string
  usergroup: string
  email?: string
  build?: string | boolean
  manage?: string | boolean
  tools?: string | boolean
  role?: string
  usertype?: string
  pageaccess?: string
}): Promise<{ accessToken: string; refreshToken: string }> {
  const sessionId = generateSecureToken(16)
  const jti = generateSecureToken(8)

  const resolvedRole = resolveUserRole(user)
  const resolvedPermissions = resolvePermissions(user, resolvedRole)

  const payload: Omit<TokenPayload, "iat" | "exp"> = {
    username: user.username,
    usergroup: user.usergroup || resolvedRole,
    email: user.email,
    role: resolvedRole,
    usertype: user.usertype,
    permissions: resolvedPermissions,
    sessionId,
    jti,
  }

  // Create access token
  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .setIssuer("bhel-transport-system")
    .setAudience("bhel-employees")
    .sign(JWT_SECRET)

  // Create refresh token with longer expiry
  const refreshToken = await new SignJWT({
    username: user.username,
    sessionId,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
    .setIssuer("bhel-transport-system")
    .setAudience("bhel-employees")
    .sign(JWT_SECRET)

  return { accessToken, refreshToken }
}

// Verify JWT token
export async function verifySecureToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "bhel-transport-system",
      audience: "bhel-employees",
    })

    // Validate payload structure before casting
    if (typeof payload.username === 'string' && typeof payload.usergroup === 'string' && typeof payload.sessionId === 'string') {
      return payload as unknown as TokenPayload
    }
    return null
  } catch (error) {
    console.error("Token verification failed:", error)
    return null
  }
}

// Set secure HTTP-only cookies
export async function setSecureAuthCookies(tokens: { accessToken: string; refreshToken: string }) {
  const cookieStore = await cookies()

  // Access token - shorter expiry
  cookieStore.set("auth-token", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  })

  // Refresh token - longer expiry
  cookieStore.set("refresh-token", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

// Get authenticated user from cookies
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")

    if (!token) {
      return null
    }

    const payload = await verifySecureToken(token.value)
    if (!payload) {
      return null
    }

    const resolvedRole = payload.role || resolveUserRole({ username: payload.username, usergroup: payload.usergroup })
    const resolvedPermissions = payload.permissions || resolvePermissions({}, resolvedRole)

    return {
      username: payload.username,
      usergroup: payload.usergroup,
      email: payload.email,
      role: resolvedRole,
      usertype: payload.usertype,
      permissions: resolvedPermissions,
    }
  } catch (error) {
    console.error("Error getting authenticated user:", error)
    return null
  }
}

// Require authenticated user with administrator privileges
export async function requireAdminUser(): Promise<AuthUser | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  if (user.role !== "admin") return null
  return user
}


// Clear authentication cookies
export async function clearAuthCookies() {
  const cookieStore = await cookies()

  cookieStore.set("auth-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  })

  cookieStore.set("refresh-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
  })
}

// Refresh access token using refresh token
export async function refreshAccessToken(): Promise<{ accessToken: string } | null> {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("refresh-token")

    if (!refreshToken) {
      return null
    }

    const payload = await verifySecureToken(refreshToken.value)
    if (!payload || payload.type !== "refresh") {
      return null
    }

    // In a real application, you would fetch the user from database
    // For now, we'll create a new token with the existing username
    const user = {
      username: payload.username,
      usergroup: "employee", // Default, should be fetched from DB
    }

    const tokens = await createSecureToken(user)
    
    // Set the new access token
    cookieStore.set("auth-token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60, // 1 hour
    })

    return { accessToken: tokens.accessToken }
  } catch (error) {
    console.error("Token refresh failed:", error)
    return null
  }
}

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_TIME = 15 * 60 * 1000 // 15 minutes

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const attempt = loginAttempts.get(identifier)

  if (!attempt) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now })
    return { allowed: true }
  }

  // Reset if lockout time has passed
  if (now - attempt.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now })
    return { allowed: true }
  }

  // Check if max attempts exceeded
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil((attempt.lastAttempt + LOCKOUT_TIME - now) / 1000)
    return { allowed: false, retryAfter }
  }

  // Increment attempt count
  attempt.count++
  attempt.lastAttempt = now
  return { allowed: true }
}

// Clear rate limit on successful login
export function clearRateLimit(identifier: string) {
  loginAttempts.delete(identifier)
}