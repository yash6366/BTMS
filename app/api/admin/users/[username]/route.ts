import { type NextRequest, NextResponse } from "next/server"
import { setUserAccountStatus } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { username } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const active = body.active === "1" || body.active === true ? "1" : "0"
    await setUserAccountStatus(username, active, admin.username, clientIP)

    return NextResponse.json({
      success: true,
      message: active === "1" ? `User ${username} activated.` : `User ${username} deactivated.`,
      active,
    })
  } catch (error) {
    console.error("PATCH /api/admin/users/[username] error:", error)
    return NextResponse.json({ error: "Failed to update user account status." }, { status: 500 })
  }
}
