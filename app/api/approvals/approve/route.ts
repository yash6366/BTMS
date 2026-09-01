import { type NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  try {
    // 1. Get authenticated user or decode token
    let username: string | null = null
    const authUser = await getAuthenticatedUser()
    if (authUser) {
      username = authUser.username
    } else {
      const cookieStore = await cookies()
      const token = cookieStore.get("auth-token")?.value
      if (!token) {
        return NextResponse.json({ error: "Unauthorized - No token" }, { status: 401 })
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

    // 2. Parse request body
    const requestData = await req.json()
    const { serial, status, remarks } = requestData

    if (!serial || !["APVD", "REJ"].includes(status)) {
      return NextResponse.json({ error: "Invalid input. Status must be APVD or REJ" }, { status: 400 })
    }

    // 3. Execute atomic approval and transport sync inside a transaction
    const result = await withTransaction(async (client) => {
      // Check if booking exists
      const bookingCheck = await client.query(
        `SELECT "SERIAL_NO", "STATUS_APVR", "STAFF_NO_APVR", "PASSENGER_NAME", "STATUS_USER"
         FROM "cabbooking1_new"
         WHERE "SERIAL_NO" = $1`,
        [serial]
      )

      if (bookingCheck.rows.length === 0) {
        throw new Error("Booking not found")
      }

      const booking = bookingCheck.rows[0]
      const currentStatus = booking.STATUS_APVR
      if (currentStatus === "APVD" || currentStatus === "REJ") {
        throw new Error(`Booking already ${currentStatus === "APVD" ? "approved" : "rejected"}`)
      }

      // Update cabbooking1_new status
      const updateResult = await client.query(
        `UPDATE "cabbooking1_new"
         SET 
           "STATUS_APVR" = $1,
           "PASS_DATE_APVR" = NOW(),
           "REMARKS_APVR" = $2,
           "STAFF_NO_APVR" = $3
         WHERE "SERIAL_NO" = $4
         RETURNING "SERIAL_NO"`,
        [status, remarks || "", username, serial]
      )

      if (updateResult.rows.length === 0) {
        throw new Error("Failed to update booking status")
      }

      // Mark notification processed
      await client.query(
        `UPDATE "APPROVAL_NOTIFICATIONS"
         SET "STATUS" = 'PROCESSED', "UPDATED_DATE" = NOW()
         WHERE "SERIAL_NO" = $1`,
        [serial]
      )

      // If approved, sync to CABBOOKING_DETAILS
      if (status === "APVD") {
        const fullBookingRes = await client.query(
          `SELECT * FROM "cabbooking1_new" WHERE "SERIAL_NO" = $1`,
          [serial]
        )

        if (fullBookingRes.rows.length > 0) {
          const b = fullBookingRes.rows[0]
          const existingTransport = await client.query(
            `SELECT "INTERNAL_NO" FROM "CABBOOKING_DETAILS" WHERE "INTERNAL_NO" = $1`,
            [serial]
          )

          if (existingTransport.rows.length === 0) {
            let transportSerialNo = b.SERIAL_NO || ""
            if (transportSerialNo.length > 4) {
              const numericPart = transportSerialNo.replace(/[^0-9]/g, "")
              transportSerialNo = numericPart.substring(numericPart.length - 4).padStart(4, "0")
            }

            await client.query(
              `INSERT INTO "CABBOOKING_DETAILS" (
                "SERIAL_NO", "STAFF_NO_INDTR", "STAFF_NO_USER", "PASSENGER_NAME", "MOB_NO_INDTR", "MOB_NO_USER",
                "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM", "DESTINATION",
                "TRIP_TIME", "TRIP_DATE", "INDENT_DATE", "VEH_REQUESTED", "DURATION_REQ",
                "PURPOSE", "REMARKS_USER", "STAFF_NO_APVR", "STATUS_USER", "PASS_DATE_APVR", "REMARKS_APVR",
                "STATUS_APVR", "COMPANY_NAME", "OTHER_DETAILS", "DEPT_USER",
                "INDENTER_NAME", "INTERNAL_NO", "STATUS_TRANS"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, 'PEND'
              ) ON CONFLICT ("SERIAL_NO") DO NOTHING;`,
              [
                transportSerialNo,
                b.STAFF_NO_INDTR || b.STAFF_NO_USER,
                b.STAFF_NO_USER,
                b.PASSENGER_NAME,
                b.MOB_NO_INDTR,
                b.MOB_NO_USER,
                b.STARTING_PLACE || b.TAKE_OFF_FROM,
                b.FLIGHT_TRAIN_NO,
                b.TAKE_OFF_FROM,
                b.DESTINATION,
                b.TRIP_TIME,
                b.TRIP_DATE,
                b.INDENT_DATE,
                b.VEH_REQUESTED,
                b.DURATION_REQ,
                b.PURPOSE,
                b.REMARKS_USER,
                b.STAFF_NO_APVR,
                b.STATUS_USER,
                b.PASS_DATE_APVR || new Date(),
                b.REMARKS_APVR,
                b.STATUS_APVR,
                b.COMPANY_NAME,
                b.OTHER_DETAILS,
                b.DEPT_USER,
                b.INDENTER_NAME || b.PASSENGER_NAME,
                b.SERIAL_NO,
              ]
            )
          }
        }
      }

      return { serial, status }
    })

    return NextResponse.json({
      success: true,
      message: `Booking ${status === "APVD" ? "approved" : "rejected"} successfully`,
      serialNo: result.serial,
      status: result.status,
      syncedToTransport: status === "APVD",
    })
  } catch (error) {
    console.error("POST /api/approvals/approve error:", error)
    const errorMsg = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: errorMsg }, { status: errorMsg.includes("not found") ? 404 : 400 })
  }
}
