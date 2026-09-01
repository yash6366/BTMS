import { type NextRequest, NextResponse } from "next/server"
import { getEmployeeMasterList, addEmployeeMaster } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"
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
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || undefined
    const department = searchParams.get("department") || undefined
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const result = await getEmployeeMasterList({ search, department, limit, offset })
    return NextResponse.json({
      success: true,
      employees: result.employees,
      total: result.total,
    })
  } catch (error) {
    console.error("GET /api/admin/employees error:", error)
    return NextResponse.json({ error: "Failed to retrieve employee directory." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const parsed = AddEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed for employee details.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    try {
      const newEmployee = await addEmployeeMaster(parsed.data, admin.username, clientIP)
      return NextResponse.json({
        success: true,
        message: "Employee successfully added to Master Directory.",
        employee: newEmployee,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "ERROR"
      if (msg === "EMPLOYEE_ALREADY_EXISTS") {
        return NextResponse.json(
          { error: "An employee with this Staff Number or Email already exists in the directory." },
          { status: 409 }
        )
      }
      throw err
    }
  } catch (error) {
    console.error("POST /api/admin/employees error:", error)
    return NextResponse.json({ error: "Failed to create employee record." }, { status: 500 })
  }
}
