import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, authenticateTransportUser } from "@/lib/auth"
import { createSecureToken, setSecureAuthCookies, checkRateLimit, clearRateLimit } from "@/lib/secure-auth"

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

    // Determine user role based on user type and permissions
    let userRole = "employee"
    let redirectTo = "/dashboard"

    const isAdmin =
      user.usergroup?.toLowerCase().includes("admin") ||
      user.pageaccess?.toLowerCase().includes("admin") ||
      user.username?.toLowerCase() === "admin"

    if (isAdmin) {
      userRole = "admin"
      redirectTo = "/admin"
    } else if (userType === 'transport' || user.tools === '1' || user.usergroup?.toLowerCase().includes("transport")) {
      userRole = "transport"
      redirectTo = "/transport-dashboard"
    } else {
      const isManager = user.manage === "1" || user.usergroup?.toLowerCase().includes("manager")
      userRole = isManager ? "manager" : "employee"
      redirectTo = userRole === "manager" ? "/manager-dashboard" : "/dashboard"
    }

    // Create secure JWT tokens
    const tokens = await createSecureToken({
      username: user.username,
      usergroup: user.usergroup || "employee",
      email: user.email,
      build: user.build,
      manage: user.manage,
      tools: user.tools,
      role: userRole,
      usertype: userType,
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
        permissions: {
          build: user.build === "1",
          manage: user.manage === "1",
          tools: user.tools === "1",
        },
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