import { type NextRequest, NextResponse } from "next/server"
import { getEmployeeMasterList, addEmployeeMaster } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"
import { parseBoundedPagination, sanitizeSearchQuery } from "@/lib/query-bounds"
import { getOrGenerateCorrelationId, createSafeErrorResponse } from "@/lib/logger"
import { z } from "zod"

export const dynamic = "force-dynamic"

const AddEmployeeSchema = z.object({
  empId: z.string().trim().min(3, "Staff number must be at least 3 characters").max(20).regex(/^[0-9A-Za-z_-]+$/, "Invalid staff ID format"),
  firstName: z.string().trim().min(1, "First name is required").max(50),
  middleName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  designation: z.string().trim().min(1, "Designation is required").max(100),
  email: z.string().trim().email("Invalid official email address"),
  department: z.string().trim().min(1, "Department is required").max(50),
})

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
    const rawSearch = searchParams.get("search")
    const search = rawSearch ? sanitizeSearchQuery(rawSearch) : undefined
    const department = searchParams.get("department") || undefined

    const { page, pageSize, offset } = parseBoundedPagination(
      searchParams.get("page"),
      searchParams.get("pageSize") || searchParams.get("limit")
    )

    const result = await getEmployeeMasterList({ search, department, limit: pageSize, offset })
    return NextResponse.json(
      {
        success: true,
        employees: result.employees,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize) || 1,
        },
        total: result.total,
        correlationId,
      },
      { headers: { "X-Correlation-ID": correlationId } }
    )
  } catch (error) {
    return createSafeErrorResponse(error, correlationId)
  }
}

export async function POST(req: NextRequest) {
  const correlationId = getOrGenerateCorrelationId(req.headers.get("x-correlation-id"))

  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privileges required.", correlationId },
        { status: 403, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const parsed = AddEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten().fieldErrors, correlationId },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    const emp = await addEmployeeMaster(
      parsed.data,
      admin.username,
      clientIP
    )

    return NextResponse.json(
      { success: true, employee: emp, correlationId },
      { headers: { "X-Correlation-ID": correlationId } }
    )
  } catch (error) {
    return createSafeErrorResponse(error, correlationId)
  }
}
