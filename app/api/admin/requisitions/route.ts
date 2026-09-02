import { type NextRequest, NextResponse } from "next/server"
import { AdminTransportService } from "@/lib/admin-transport-service"
import { requireAdminUser } from "@/lib/secure-auth"
import { parseBoundedPagination, sanitizeSearchQuery } from "@/lib/query-bounds"
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

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "ALL"
    const rawSearch = searchParams.get("search")
    const search = rawSearch ? sanitizeSearchQuery(rawSearch) : undefined
    const department = searchParams.get("department") || undefined

    const { page, pageSize } = parseBoundedPagination(
      searchParams.get("page"),
      searchParams.get("pageSize")
    )

    const [requisitionData, kpis] = await Promise.all([
      AdminTransportService.getRequisitionsList({ status, search, department, page, pageSize }),
      AdminTransportService.getTransportKPIs(),
    ])

    return NextResponse.json(
      {
        success: true,
        requisitions: requisitionData.requisitions,
        pagination: requisitionData.pagination,
        kpis,
        correlationId,
      },
      { headers: { "X-Correlation-ID": correlationId } }
    )
  } catch (error) {
    return createSafeErrorResponse(error, correlationId)
  }
}
