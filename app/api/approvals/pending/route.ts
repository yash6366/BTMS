import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    let username: string | null = null
    const authUser = await getAuthenticatedUser()
    if (authUser) {
      username = authUser.username
    } else {
      const cookieStore = await cookies()
      const token = cookieStore.get("auth-token")?.value
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      try {
        const decoded = Buffer.from(token, "base64").toString()
        username = decoded.split(":")[0]
      } catch {
        return NextResponse.json({ error: "Invalid token format" }, { status: 401 })
      }
    }

    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Query cabbooking1_new using username as STAFF_NO_APVR
    const approvalsRes = await query(
      `
      SELECT * 
      FROM "cabbooking1_new"
      WHERE "STATUS_APVR" = 'OPEN' AND "STAFF_NO_APVR" = $1
      ORDER BY "TRIP_DATE" DESC NULLS LAST
    `,
      [username]
    )

    return NextResponse.json({ approvals: approvalsRes.rows })
  } catch (error) {
    console.error("Error fetching approvals:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
