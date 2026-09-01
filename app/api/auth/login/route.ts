import { type NextRequest, NextResponse } from "next/server"
import { authenticateUser, authenticateTransportUser } from "@/lib/auth"
import { createSecureToken, setSecureAuthCookies, checkRateLimit, clearRateLimit } from "@/lib/secure-auth"

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password, userType } = await request.json()

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

    // Connect to database and authenticate user
    let user = null
    let actualUserType = 'regular'

    // If userType is transport, try transport authentication first
    if (userType === 'transport') {
      user = await authenticateTransportUser(username, password)
      if (user) {
        actualUserType = 'transport'
      }
    }

    // If transport authentication failed or userType is not transport, try regular authentication
    if (!user) {
      user = await authenticateUser(username, password)
      if (user) {
        actualUserType = 'regular'
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password, or account is inactive" }, { status: 401 })
    }

    // Clear rate limit on successful authentication
    clearRateLimit(clientIP)

    // If this is a manager login request, verify manager permissions
    if (userType === "manager") {
      const isManager = user.manage === "1" || 
                       user.usergroup?.toLowerCase().includes("manager") ||
                       user.usergroup?.toLowerCase().includes("admin")
      
      if (!isManager) {
        return NextResponse.json({ 
          error: "Access denied. Manager privileges required for this portal." 
        }, { status: 403 })
      }
    }

    // If this is a transport login request, verify transport permissions
    if (userType === "transport" && actualUserType !== 'transport') {
      return NextResponse.json({ 
        error: "Access denied. Transport privileges required for this portal." 
      }, { status: 403 })
    }

    // Determine user role based on actual user type and permissions
    let userRole = "employee"
    if (actualUserType === 'transport') {
      userRole = "transport"
    } else {
      const isManager = user.manage === "1" || 
                       user.usergroup?.toLowerCase().includes("manager") ||
                       user.usergroup?.toLowerCase().includes("admin")
      userRole = isManager ? "manager" : "employee"
    }

    // Create secure JWT tokens
    const tokens = await createSecureToken({
      username: user.username,
      usergroup: user.usergroup || (actualUserType === 'transport' ? 'transport' : 'employee'),
      email: user.email,
      build: user.build,
      manage: user.manage,
      tools: user.tools,
      role: userRole,
      usertype: actualUserType,
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
        usertype: actualUserType,
        permissions: {
          build: user.build === "1",
          manage: user.manage === "1",
          tools: user.tools === "1",
        },
        pageaccess: user.pageaccess,
        reportingto: user.reportingto,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
