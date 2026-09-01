import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"
import { getUserByUsername } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    // 1. Get authenticated user
    const authUser = await getAuthenticatedUser()
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // 2. Get full user details from database
    const fullUser = await getUserByUsername(authUser.username)
    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const {
      name,
      mobile,
      indenter,
      indenterMobile,
      deptCode,
      otherDetails,
      internalNo,
      pickupFields,
      STATUS_APVR = "OPEN",
    } = body

    const STAFF_NO_USER = (fullUser.username || "").substring(0, 7)
    const INDENTER_NAME = indenter || name || fullUser.username

    if (!pickupFields) {
      return NextResponse.json({ error: "Missing pickup details" }, { status: 400 })
    }

    if (!pickupFields.date) {
      return NextResponse.json({ error: "Trip date is required" }, { status: 400 })
    }

    const tripDate = new Date(pickupFields.date)
    if (isNaN(tripDate.getTime())) {
      return NextResponse.json({ error: "Invalid TRIP_DATE" }, { status: 400 })
    }

    const indentDate = new Date()

    // Execute atomic booking and notification in a single PostgreSQL transaction
    const result = await withTransaction(async (client) => {
      const insertSql = `
        INSERT INTO "cabbooking1_new" (
          "PASSENGER_NAME", "MOB_NO_USER", "INDENTER_NAME", "MOB_NO_INDTR",
          "STAFF_NO_INDTR", "STAFF_NO_USER", "DEPT_USER", "OTHER_DETAILS", "INTERNAL_NO",
          "STARTING_PLACE", "FLIGHT_TRAIN_NO", "TAKE_OFF_FROM", "DESTINATION",
          "TRIP_TIME", "TRIP_DATE", "INDENT_DATE",
          "VEH_REQUESTED", "DURATION_REQ", "PURPOSE", "STAFF_NO_APVR",
          "STATUS_APVR", "STATUS_USER"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22
        ) RETURNING "BookingID" AS "InsertedID";
      `

      const insertValues = [
        name || "",
        mobile || "",
        INDENTER_NAME || "",
        indenterMobile || "",
        STAFF_NO_USER || "",
        STAFF_NO_USER || "",
        deptCode || "",
        otherDetails || "",
        internalNo || "",
        pickupFields.from || pickupFields.station_name || pickupFields.airport_name || "",
        pickupFields.flight_no || pickupFields.train_no || "",
        pickupFields.coming_from || "",
        pickupFields.drop_at || pickupFields.to || "",
        pickupFields["pick-up_time"] || "",
        tripDate,
        indentDate,
        pickupFields.select_car || "",
        pickupFields.duration || "",
        pickupFields.purpose || "",
        (pickupFields.approver || "").substring(0, 7),
        STATUS_APVR.substring(0, 4),
        "CLSD",
      ]

      const insertResult = await client.query(insertSql, insertValues)
      const insertedId = insertResult.rows[0].InsertedID
      const serialNo = `TAXI${insertedId}`

      // Update the booking record with generated serial number
      await client.query(
        `UPDATE "cabbooking1_new" SET "SERIAL_NO" = $1 WHERE "BookingID" = $2`,
        [serialNo, insertedId]
      )

      // Create manager notification
      const approverStaffNo = (pickupFields.approver || "").substring(0, 7)
      if (approverStaffNo) {
        try {
          await client.query(
            `
            INSERT INTO "APPROVAL_NOTIFICATIONS" (
              "SERIAL_NO", "APPROVER_STAFF_NO", "REQUESTER_NAME", "PASSENGER_NAME",
              "TRIP_DATE", "PURPOSE", "NOTIFICATION_DATE", "STATUS"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
            [
              serialNo,
              approverStaffNo,
              INDENTER_NAME || "",
              name || "",
              tripDate,
              pickupFields.purpose || "",
              new Date(),
              "PENDING",
            ]
          )
        } catch (notifErr) {
          console.warn("Could not insert notification record:", notifErr)
        }
      }

      return { bookingId: insertedId, serialNo }
    })

    return NextResponse.json({
      message: "Booking submitted successfully and sent for manager approval",
      bookingId: result.bookingId,
      serialNo: result.serialNo,
      status: "PENDING_APPROVAL",
    })
  } catch (error) {
    console.error("❌ Booking submission failed:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Internal Server Error", details: errorMessage }, { status: 500 })
  }
}
