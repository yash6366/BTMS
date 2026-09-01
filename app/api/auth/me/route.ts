import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/secure-auth"

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        username: user.username,
        usergroup: user.usergroup,
        email: user.email,
        role: user.role || (user.permissions?.manage ? "manager" : "employee"),
        usertype: user.usertype,
        permissions: user.permissions,
      },
    })
  } catch (error) {
    console.error("GET /api/auth/me error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
