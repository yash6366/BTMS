import { type NextRequest, NextResponse } from "next/server"
import { getAdminAuditLogs } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50", 10)

    const logs = await getAdminAuditLogs(limit)
    return NextResponse.json({
      success: true,
      logs,
    })
  } catch (error) {
    console.error("GET /api/admin/audit error:", error)
    return NextResponse.json({ error: "Failed to retrieve audit logs." }, { status: 500 })
  }
}
