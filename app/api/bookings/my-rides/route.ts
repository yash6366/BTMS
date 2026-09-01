import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

interface BookingRow {
  SERIAL_NO?: string
  PASSENGER_NAME?: string
  STARTING_PLACE?: string
  DESTINATION?: string
  TRIP_DATE?: string | Date | null
  TRIP_TIME?: string
  VEH_REQUESTED?: string
  DURATION_REQ?: string
  PURPOSE?: string
  STATUS_APVR?: string
  STATUS_DESCRIPTION?: string
  PASS_DATE_APVR?: string | Date | null
  REMARKS_APVR?: string
  INDENT_DATE?: string | Date | null
  OTHER_DETAILS?: string
  VEH_ALLOTTED?: string
  VEHICLE_NO?: string
  DRIVER_NAME?: string
  DRIVER_MOB_NO?: string
  FLIGHT_TRAIN_NO?: string
  TAKE_OFF_FROM?: string
  [key: string]: unknown
}

// In-memory cache for user bookings (expires after 2 minutes)
const bookingsCache = new Map<string, { data: BookingRow[]; timestamp: number }>()
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const username = user.username

    // Check cache first
    const cacheKey = `bookings-${username}`
    const cached = bookingsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(
        {
          bookings: cached.data,
          cached: true,
          cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000),
        },
        {
          headers: {
            "Cache-Control": "private, max-age=60",
            "X-Cache-Status": "HIT",
          },
        }
      )
    }

    // Get all bookings made by this user with PostgreSQL parameterized query
    const bookings = await query(
      `
      SELECT 
        "SERIAL_NO",
        "PASSENGER_NAME",
        "STARTING_PLACE",
        "DESTINATION",
        "TRIP_DATE",
        "TRIP_TIME",
        "VEH_REQUESTED",
        "DURATION_REQ",
        "PURPOSE",
        "STATUS_APVR",
        "PASS_DATE_APVR",
        "REMARKS_APVR",
        "INDENT_DATE",
        "OTHER_DETAILS",
        "VEH_ALLOTTED",
        "VEHICLE_NO",
        "DRIVER_NAME",
        "DRIVER_MOB_NO",
        "FLIGHT_TRAIN_NO",
        "TAKE_OFF_FROM"
      FROM "cabbooking1_new"
      WHERE "STAFF_NO_USER" = $1
      ORDER BY "INDENT_DATE" DESC NULLS LAST
    `,
      [username]
    )

    // Format the response with status descriptions
    const formattedBookings = bookings.rows.map((booking) => ({
      ...booking,
      STATUS_DESCRIPTION: getStatusDescription(booking.STATUS_APVR),
      TRIP_DATE: booking.TRIP_DATE ? new Date(booking.TRIP_DATE).toISOString().split("T")[0] : null,
      INDENT_DATE: booking.INDENT_DATE ? new Date(booking.INDENT_DATE).toISOString().split("T")[0] : null,
      PASS_DATE_APVR: booking.PASS_DATE_APVR ? new Date(booking.PASS_DATE_APVR).toISOString().split("T")[0] : null,
    }))

    // Cache the results
    bookingsCache.set(cacheKey, {
      data: formattedBookings,
      timestamp: Date.now(),
    })

    // Clean old cache entries
    if (bookingsCache.size > 100) {
      const oldestKeys = Array.from(bookingsCache.keys()).slice(0, 20)
      oldestKeys.forEach((key) => bookingsCache.delete(key))
    }

    return NextResponse.json(
      {
        bookings: formattedBookings,
        count: formattedBookings.length,
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Cache-Status": "MISS",
        },
      }
    )
  } catch (error) {
    console.error("Get my rides error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function getStatusDescription(status: string): string {
  switch (status) {
    case "OPEN":
      return "Pending Manager Approval"
    case "APVD":
      return "Approved - Vehicle will be assigned"
    case "REJ":
      return "Rejected by Manager"
    case "ALLOTTED":
      return "Vehicle Assigned"
    case "COMPLETED":
      return "Trip Completed"
    default:
      return "Unknown Status"
  }
}