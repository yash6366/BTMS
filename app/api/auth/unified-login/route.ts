import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, authenticateTransportUser } from "@/lib/auth"
import { 
  createSecureToken, 
  setSecureAuthCookies, 
  checkRateLimit, 
  clearRateLimit,
  resolveUserRole,
  resolvePermissions
} from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    // Get client IP for rate limiting
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const rateLimit = checkRateLimit(clientIP)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: `Too many login attempts. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`,
          retryAfter: rateLimit.retryAfter 
        }, 
        { status: 429 }
      )
    }

    // Execute single-pass authentication
    const user = await authenticateUser(username, password)

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password, or account is inactive" }, { status: 401 })
    }

    // Determine user type (transport vs regular)
    const isTransportUser =
      user.tools === "1" ||
      user.tools === "Y" ||
      user.usergroup?.toLowerCase().includes("transport") ||
      user.username?.toLowerCase() === "transport"
    const userType = isTransportUser ? "transport" : "regular"

    // Clear rate limit on successful authentication
    clearRateLimit(clientIP)

    // Determine authoritative canonical user role and permissions
    const userRole = resolveUserRole({
      username: user.username,
      usergroup: user.usergroup,
      pageaccess: user.pageaccess,
      manage: user.manage,
      tools: user.tools,
      usertype: userType,
    })
    const userPermissions = resolvePermissions(user, userRole)

    let redirectTo = "/dashboard"
    if (userRole === "admin") {
      redirectTo = "/admin"
    } else if (userRole === "transport") {
      redirectTo = "/transport-dashboard"
    } else if (userRole === "manager") {
      redirectTo = "/dashboard"
    }

    // Create secure JWT tokens with canonical claims
    const tokens = await createSecureToken({
      username: user.username,
      usergroup: user.usergroup || userRole,
      email: user.email,
      build: user.build,
      manage: user.manage,
      tools: user.tools,
      role: userRole,
      usertype: userType,
      pageaccess: user.pageaccess,
    })

    // Set secure HTTP-only cookies
    await setSecureAuthCookies(tokens)

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        usergroup: user.usergroup,
        email: user.email,
        role: userRole,
        usertype: userType,
        permissions: userPermissions,
        pageaccess: user.pageaccess,
        reportingto: user.reportingto,
      },
      redirectTo,
    })
  } catch (error) {
    console.error("Unified login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}