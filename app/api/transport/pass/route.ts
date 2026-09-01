import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { serial, status, vehicleDetails, remarks } = await request.json()

    if (!serial || !status) {
      return NextResponse.json({ error: "Serial number and status are required" }, { status: 400 })
    }

    if (!["PASSED", "DENIED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be PASSED or DENIED" }, { status: 400 })
    }

    const dbStatus = status === "PASSED" ? "PASS" : "DENY"

    const updateFields: string[] = ['"STATUS_TRANS" = $1', '"PASS_DATE_APVR" = NOW()']
    const params: unknown[] = [dbStatus]
    let paramIndex = 2

    if (status === "PASSED" && vehicleDetails) {
      if (vehicleDetails.vehicleAllotted) {
        updateFields.push(`"VEH_ALLOTTED" = $${paramIndex++}`)
        params.push(vehicleDetails.vehicleAllotted)
      }
      if (vehicleDetails.vehicleNo) {
        updateFields.push(`"VEHICLE_NO" = $${paramIndex++}`)
        params.push(vehicleDetails.vehicleNo)
      }
      if (vehicleDetails.driverName) {
        updateFields.push(`"DRIVER_NAME" = $${paramIndex++}`)
        params.push(vehicleDetails.driverName)
      }
      if (vehicleDetails.driverMobile) {
        updateFields.push(`"DRIVER_MOB_NO" = $${paramIndex++}`)
        params.push(vehicleDetails.driverMobile)
      }
    }

    if (remarks) {
      updateFields.push(`"REMARKS_TRANS" = $${paramIndex++}`)
      params.push(remarks)
    }

    const whereParamIndex = paramIndex
    params.push(serial)

    const updateQuery = `
      UPDATE "CABBOOKING_DETAILS" 
      SET ${updateFields.join(", ")}
      WHERE "SERIAL_NO" = $${whereParamIndex}
    `

    await query(updateQuery, params)

    return NextResponse.json({
      success: true,
      message: `Booking ${serial} has been ${status.toLowerCase()} successfully`,
    })
  } catch (error) {
    console.error("Error updating transport status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}