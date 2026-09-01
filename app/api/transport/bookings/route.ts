import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "approved"

    let sql = `
      SELECT 
        "SERIAL_NO",
        "PASSENGER_NAME",
        "TAKE_OFF_FROM",
        "DESTINATION",
        "TRIP_DATE",
        "VEH_REQUESTED",
        "STATUS_APVR",
        "PASS_DATE_APVR",
        "VEH_ALLOTTED",
        "VEHICLE_NO",
        "DRIVER_NAME",
        "DRIVER_MOB_NO",
        "PURPOSE",
        "REMARKS_USER",
        "COMPANY_NAME",
        "DEPT_USER",
        "INDENT_DATE",
        "TRIP_TIME",
        "DURATION_REQ",
        "FLIGHT_TRAIN_NO",
        "OTHER_DETAILS",
        "REMARKS_APVR",
        "MOB_NO_USER",
        "REMARKS_TRANS",
        "STATUS_TRANS"
      FROM "CABBOOKING_DETAILS"
      WHERE 1=1
    `

    const params: unknown[] = []

    if (status === "approved") {
      sql += " AND \"STATUS_APVR\" = 'APVD' AND (\"STATUS_TRANS\" IS NULL OR \"STATUS_TRANS\" = '' OR \"STATUS_TRANS\" = 'OPEN' OR \"STATUS_TRANS\" = 'PEND')"
    } else if (status === "passed") {
      sql += " AND \"STATUS_TRANS\" = 'PASS'"
    }

    sql += ' ORDER BY "TRIP_DATE" DESC NULLS LAST'

    const result = await query(sql, params)

    return NextResponse.json({
      success: true,
      bookings: result.rows,
    })
  } catch (error) {
    console.error("Error fetching transport bookings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}