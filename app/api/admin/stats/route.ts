import { type NextRequest, NextResponse } from "next/server"
import { getAdminDashboardStats } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const stats = await getAdminDashboardStats()
    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("GET /api/admin/stats error:", error)
    return NextResponse.json(
      {
        error: "Failed to retrieve administrative statistics.",
      },
      { status: 500 }
    )
  }
}
