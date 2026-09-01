import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
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

    // Get pending notifications for this manager
    const notifications = await query(
      `
      SELECT 
        n."ID" as "NOTIFICATION_ID",
        n."SERIAL_NO",
        n."REQUESTER_NAME",
        n."PASSENGER_NAME",
        n."TRIP_DATE",
        n."PURPOSE",
        n."NOTIFICATION_DATE",
        n."STATUS" as "NOTIFICATION_STATUS",
        b."STATUS_APVR",
        b."STARTING_PLACE",
        b."DESTINATION",
        b."VEH_REQUESTED",
        b."TRIP_TIME",
        b."DURATION_REQ",
        b."OTHER_DETAILS"
      FROM "APPROVAL_NOTIFICATIONS" n
      LEFT JOIN "cabbooking1_new" b ON n."SERIAL_NO" = b."SERIAL_NO"
      WHERE n."APPROVER_STAFF_NO" = $1 
      AND n."STATUS" IN ('PENDING', 'READ')
      AND (b."STATUS_APVR" = 'OPEN' OR b."STATUS_APVR" IS NULL)
      ORDER BY n."NOTIFICATION_DATE" DESC NULLS LAST
    `,
      [username]
    )

    // Mark notifications as read
    await query(
      `
      UPDATE "APPROVAL_NOTIFICATIONS" 
      SET "STATUS" = 'READ', "UPDATED_DATE" = NOW()
      WHERE "APPROVER_STAFF_NO" = $1 
      AND "STATUS" = 'PENDING'
    `,
      [username]
    )

    return NextResponse.json({
      notifications: notifications.rows,
      count: notifications.rows.length,
    })
  } catch (error) {
    console.error("Get manager notifications error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}