import { NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Demo setup not available in production" }, { status: 403 })
    }

    const testBookings = [
      {
        passengerName: "John Doe",
        staffNoUser: "testuser",
        takeOffFrom: "BHEL Gate",
        destination: "Airport",
        tripDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tripTime: "10:00",
        purpose: "Business Travel",
        vehicleRequested: "SEDAN",
        statusUser: "CLSD",
        statusApvr: "OPEN",
        staffNoApvr: "3787702",
      },
      {
        passengerName: "Jane Smith",
        staffNoUser: "testuser",
        takeOffFrom: "Office Block A",
        destination: "Railway Station",
        tripDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        tripTime: "14:30",
        purpose: "Official Meeting",
        vehicleRequested: "HATCHBACK",
        statusUser: "CLSD",
        statusApvr: "OPEN",
        staffNoApvr: "3787702",
      },
    ]

    const insertedBookings = []

    for (const booking of testBookings) {
      const res = await query(
        `
        INSERT INTO "cabbooking1_new" (
          "PASSENGER_NAME", "STAFF_NO_USER", "TAKE_OFF_FROM", "DESTINATION",
          "TRIP_DATE", "TRIP_TIME", "PURPOSE", "VEH_REQUESTED",
          "STATUS_USER", "STATUS_APVR", "STAFF_NO_APVR", "INDENT_DATE"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING "BookingID" AS "InsertedID";
      `,
        [
          booking.passengerName,
          booking.staffNoUser,
          booking.takeOffFrom,
          booking.destination,
          booking.tripDate,
          booking.tripTime,
          booking.purpose,
          booking.vehicleRequested,
          booking.statusUser,
          booking.statusApvr,
          booking.staffNoApvr,
        ]
      )

      const id = res.rows[0].InsertedID
      const serialNo = `TAXI${id}`
      await query(`UPDATE "cabbooking1_new" SET "SERIAL_NO" = $1 WHERE "BookingID" = $2`, [serialNo, id])

      insertedBookings.push({ bookingId: id, serialNo, ...booking })
    }

    return NextResponse.json({
      success: true,
      message: "Test bookings created successfully",
      bookings: insertedBookings,
    })
  } catch (error) {
    console.error("Create bookings error:", error)
    return NextResponse.json(
      {
        error: "Failed to create test bookings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}