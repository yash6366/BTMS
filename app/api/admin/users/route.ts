import { type NextRequest, NextResponse } from "next/server"
import { getRegisteredUsersList } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || undefined
    const role = searchParams.get("role") || undefined
    const status = searchParams.get("status") || undefined

    const users = await getRegisteredUsersList({ search, role, status })
    return NextResponse.json({
      success: true,
      users,
    })
  } catch (error) {
    console.error("GET /api/admin/users error:", error)
    return NextResponse.json({ error: "Failed to retrieve user accounts." }, { status: 500 })
  }
}
