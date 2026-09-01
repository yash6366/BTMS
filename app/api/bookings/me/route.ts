import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getUserByUsername, query } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let username = ""
    try {
      username = Buffer.from(token, "base64").toString().split(":")[0]
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const user = await getUserByUsername(username)
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const result = await query(
      `
      SELECT 
        "SERIAL_NO", "PASSENGER_NAME", "TRIP_DATE", "TAKE_OFF_FROM", "DESTINATION", 
        "VEH_REQUESTED", "STATUS_APVR", "REMARKS_APVR", "PURPOSE", "INDENT_DATE"
      FROM "cabbooking1_new"
      WHERE "STAFF_NO_USER" = $1
      ORDER BY "TRIP_DATE" DESC NULLS LAST
    `,
      [username]
    )

    return NextResponse.json({ bookings: result.rows })
  } catch (err) {
    console.error("Error fetching user bookings:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
