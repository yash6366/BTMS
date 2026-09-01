import { query, getUserByUsername } from "@/lib/database"
import { cookies } from "next/headers"

export async function getManagerApprovals() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) return []

  let username = ""
  try {
    username = Buffer.from(token, "base64").toString().split(":")[0]
  } catch {
    return []
  }

  const user = await getUserByUsername(username)
  if (!user || (user.usergroup !== "manager" && user.manage !== "1")) return []

  const result = await query(
    `
    SELECT "SERIAL_NO", "PASSENGER_NAME", "TRIP_DATE", "TAKE_OFF_FROM", "DESTINATION", "VEH_REQUESTED"
    FROM "CABBOOKING_DETAILS"
    WHERE "STAFF_NO_APVR" = $1 AND ("STATUS_APVR" IS NULL OR "STATUS_APVR" = '' OR "STATUS_APVR" = 'OPEN')
    ORDER BY "TRIP_DATE" ASC NULLS LAST
  `,
    [username]
  )

  return result.rows
}
