import { type NextRequest, NextResponse } from "next/server"
import { getAccessRequests, approveAccessRequest, rejectAccessRequest } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "PENDING"

    const requests = await getAccessRequests(status)
    return NextResponse.json({
      success: true,
      requests,
    })
  } catch (error) {
    console.error("GET /api/admin/access-requests error:", error)
    return NextResponse.json({ error: "Failed to retrieve access requests." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))
    const { requestId, action, reason } = body

    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing required fields (requestId, action)." }, { status: 400 })
    }

    if (action === "approve") {
      const result = await approveAccessRequest(requestId, admin.username, clientIP)
      return NextResponse.json({
        success: true,
        message: `Access request approved. ${result.username} promoted to ${result.approvedRole}.`,
        result,
      })
    } else if (action === "reject") {
      const result = await rejectAccessRequest(requestId, reason || "Denied by Administrator", admin.username, clientIP)
      return NextResponse.json({
        success: true,
        message: `Access request rejected. ${result.username} assigned standard Employee access.`,
        result,
      })
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 })
    }
  } catch (error) {
    console.error("POST /api/admin/access-requests error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process access request." },
      { status: 500 }
    )
  }
}
