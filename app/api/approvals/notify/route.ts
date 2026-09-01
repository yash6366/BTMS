import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function POST(req: NextRequest) {
  try {
    const { serialNo, approverStaffNo, requesterName, passengerName, tripDate, purpose } = await req.json()

    if (!serialNo || !approverStaffNo || !requesterName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await query(
      `
      INSERT INTO "APPROVAL_NOTIFICATIONS" (
        "SERIAL_NO", "APPROVER_STAFF_NO", "REQUESTER_NAME", "PASSENGER_NAME",
        "TRIP_DATE", "PURPOSE", "NOTIFICATION_DATE", "STATUS"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        serialNo,
        approverStaffNo,
        requesterName,
        passengerName || null,
        tripDate ? new Date(tripDate) : null,
        purpose || "",
        new Date(),
        "PENDING",
      ]
    )

    return NextResponse.json({
      success: true,
      message: "Manager notification sent successfully",
      serialNo,
    })
  } catch (error) {
    console.error("Manager notification error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}