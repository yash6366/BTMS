import { type NextRequest, NextResponse } from "next/server"
import { withTransaction, query } from "@/lib/database"

export async function POST(_request: NextRequest) {
  try {
    const approvedBookings = await query(`
      SELECT 
        cb1.*
      FROM "cabbooking1_new" cb1
      LEFT JOIN "CABBOOKING_DETAILS" cbd ON cb1."SERIAL_NO" = cbd."INTERNAL_NO"
      WHERE cb1."STATUS_APVR" = 'APVD' 
      AND cbd."INTERNAL_NO" IS NULL
    `)

    if (approvedBookings.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new approved bookings to sync",
        syncedCount: 0,
      })
    }

    let syncedCount = 0

    await withTransaction(async (client) => {
      for (const booking of approvedBookings.rows) {
        let transportSerialNo = booking.SERIAL_NO || ""
        if (transportSerialNo.length > 4) {
          const numericPart = transportSerialNo.replace(/[^0-9]/g, "")
          transportSerialNo = numericPart.substring(numericPart.length - 4).padStart(4, "0")
        }

        await client.query(
          `
          INSERT INTO "CABBOOKING_DETAILS" (
            "SERIAL_NO", "STAFF_NO_INDTR", "STAFF_NO_USER", "PASSENGER_NAME", "MOB_NO_INDTR", "MOB_NO_USER",
            "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM", "DESTINATION",
            "TRIP_TIME", "TRIP_DATE", "INDENT_DATE", "VEH_REQUESTED", "DURATION_REQ",
            "PURPOSE", "REMARKS_USER", "STAFF_NO_APVR", "STATUS_USER", "PASS_DATE_APVR", "REMARKS_APVR",
            "STATUS_APVR", "COMPANY_NAME", "OTHER_DETAILS", "DEPT_USER",
            "INDENTER_NAME", "INTERNAL_NO", "STATUS_TRANS"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, 'PEND'
          ) ON CONFLICT ("SERIAL_NO") DO NOTHING;
        `,
          [
            transportSerialNo,
            booking.STAFF_NO_INDTR || booking.STAFF_NO_USER,
            booking.STAFF_NO_USER,
            booking.PASSENGER_NAME,
            booking.MOB_NO_INDTR,
            booking.MOB_NO_USER,
            booking.STARTING_PLACE || booking.TAKE_OFF_FROM,
            booking.FLIGHT_TRAIN_NO,
            booking.TAKE_OFF_FROM,
            booking.DESTINATION,
            booking.TRIP_TIME,
            booking.TRIP_DATE,
            booking.INDENT_DATE,
            booking.VEH_REQUESTED,
            booking.DURATION_REQ,
            booking.PURPOSE,
            booking.REMARKS_USER,
            booking.STAFF_NO_APVR,
            booking.STATUS_USER,
            booking.PASS_DATE_APVR || new Date(),
            booking.REMARKS_APVR,
            booking.STATUS_APVR,
            booking.COMPANY_NAME,
            booking.OTHER_DETAILS,
            booking.DEPT_USER,
            booking.INDENTER_NAME || booking.PASSENGER_NAME,
            booking.SERIAL_NO,
          ]
        )
        syncedCount++
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} bookings to transport`,
      syncedCount,
    })
  } catch (error) {
    console.error("Sync to transport error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}