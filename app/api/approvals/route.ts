import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/secure-auth"
import { query } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await query(`
      SELECT 
        "SERIAL_NO", 
        "PASSENGER_NAME", 
        "TAKE_OFF_FROM", 
        "DESTINATION", 
        "VEH_REQUESTED", 
        "TRIP_DATE", 
        "TRIP_TIME",
        "STATUS_APVR",
        "PURPOSE",
        "REMARKS_USER",
        "COMPANY_NAME",
        "INDENT_DATE",
        "DURATION_REQ",
        "FLIGHT_TRAIN_NO",
        "OTHER_DETAILS",
        "REMARKS_APVR",
        "PASS_DATE_APVR",
        "VEH_ALLOTTED",
        "VEHICLE_NO",
        "DRIVER_NAME",
        "DRIVER_MOB_NO",
        "MOB_NO_USER",
        "REMARKS_TRANS",
        "DEPT_USER",
        "STAFF_NO_USER",
        "STAFF_NO_APVR"
      FROM "cabbooking1_new"
      WHERE "STATUS_USER" = 'CLSD'
        AND ("STATUS_APVR" IS NULL OR "STATUS_APVR" = 'OPEN' OR "STATUS_APVR" = 'APVD' OR "STATUS_APVR" = 'REJ')
      ORDER BY "INDENT_DATE" DESC NULLS LAST, "TRIP_DATE" ASC NULLS LAST
    `)

    return NextResponse.json({
      success: true,
      approvals: result.rows,
    })
  } catch (error) {
    console.error("GET /api/approvals error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
