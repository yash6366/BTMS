import { NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Debug endpoint not available in production" }, { status: 403 })
    }

    const res = await query(`
      SELECT 
        "SERIAL_NO", 
        "PASSENGER_NAME", 
        "STAFF_NO_USER", 
        "TAKE_OFF_FROM", 
        "DESTINATION", 
        "VEH_REQUESTED", 
        "TRIP_DATE", 
        "STATUS_USER", 
        "STATUS_APVR", 
        "STAFF_NO_APVR", 
        "PURPOSE", 
        "INDENT_DATE"
      FROM "cabbooking1_new"
      ORDER BY "INDENT_DATE" DESC NULLS LAST, "SERIAL_NO" DESC NULLS LAST
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      bookingsCount: res.rows.length,
      bookings: res.rows,
    })
  } catch (error) {
    console.error("Debug bookings error:", error)
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}