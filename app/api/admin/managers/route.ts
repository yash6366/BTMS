import { type NextRequest, NextResponse } from "next/server"
import { AdminUserService } from "@/lib/admin-user-service"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const managers = await AdminUserService.getEligibleManagers()

    return NextResponse.json({
      success: true,
      managers,
    })
  } catch (error) {
    console.error("GET /api/admin/managers error:", error)
    return NextResponse.json({ error: "Failed to retrieve eligible managers." }, { status: 500 })
  }
}
