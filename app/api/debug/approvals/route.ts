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
        "TRIP_TIME", 
        "STATUS_APVR", 
        "STATUS_USER", 
        "PURPOSE", 
        "REMARKS_USER", 
        "COMPANY_NAME", 
        "INDENT_DATE", 
        "STAFF_NO_APVR", 
        "DEPT_USER"
      FROM "cabbooking1_new"
      WHERE "STATUS_USER" = 'CLSD'
        AND ("STATUS_APVR" IS NULL OR "STATUS_APVR" = 'OPEN' OR "STATUS_APVR" = 'APVD' OR "STATUS_APVR" = 'REJ')
      ORDER BY "INDENT_DATE" DESC NULLS LAST, "TRIP_DATE" ASC NULLS LAST
    `)

    const approvals = res.rows as Array<{ STATUS_APVR?: string; [key: string]: unknown }>
    const statusCounts = {
      pending: approvals.filter((r) => !r.STATUS_APVR || r.STATUS_APVR === "OPEN").length,
      approved: approvals.filter((r) => r.STATUS_APVR === "APVD").length,
      rejected: approvals.filter((r) => r.STATUS_APVR === "REJ").length,
    }

    return NextResponse.json({
      success: true,
      totalApprovals: approvals.length,
      statusCounts,
      approvals,
    })
  } catch (error) {
    console.error("Debug approvals error:", error)
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}