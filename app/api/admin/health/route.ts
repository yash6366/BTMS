import { type NextRequest, NextResponse } from "next/server"
import { databaseHealthCheck, query } from "@/lib/database"
import { requireAdminUser } from "@/lib/secure-auth"
import { getOrGenerateCorrelationId, createSafeErrorResponse } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const correlationId = getOrGenerateCorrelationId(req.headers.get("x-correlation-id"))

  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privileges required.", correlationId },
        { status: 403, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    const health = await databaseHealthCheck()

    // Table volume diagnostics
    const tableCountsRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM "axusers") as users,
        (SELECT COUNT(*) FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW") as employees,
        (SELECT COUNT(*) FROM "cabbooking1_new") as requisitions,
        (SELECT COUNT(*) FROM "CABBOOKING_DETAILS") as physical_bookings,
        (SELECT COUNT(*) FROM "ACCESS_REQUESTS") as access_requests,
        (SELECT COUNT(*) FROM "ADMIN_AUDIT_LOGS") as audit_logs
    `).catch(() => ({ rows: [{}] }))

    const counts: Record<string, any> = (tableCountsRes.rows[0] as Record<string, any>) || {}

    return NextResponse.json(
      {
        success: true,
        healthy: health.healthy,
        database: health.details,
        inventory: {
          registeredUsers: parseInt(counts.users || "0", 10),
          masterEmployees: parseInt(counts.employees || "0", 10),
          totalRequisitions: parseInt(counts.requisitions || "0", 10),
          activeTransportBookings: parseInt(counts.physical_bookings || "0", 10),
          accessRequests: parseInt(counts.access_requests || "0", 10),
          auditRecords: parseInt(counts.audit_logs || "0", 10),
        },
        timestamp: new Date().toISOString(),
        correlationId,
      },
      { headers: { "X-Correlation-ID": correlationId } }
    )
  } catch (error) {
    return createSafeErrorResponse(error, correlationId)
  }
}
