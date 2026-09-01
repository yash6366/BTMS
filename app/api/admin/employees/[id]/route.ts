import { type NextRequest, NextResponse } from "next/server"
import { updateEmployeeMaster, setEmployeeMasterStatus } from "@/lib/auth"
import { requireAdminUser } from "@/lib/secure-auth"
import { z } from "zod"

export const dynamic = "force-dynamic"

const UpdateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  middleName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().min(1).max(50),
  designation: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  department: z.string().trim().min(1).max(50),
})

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { id } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const empId = id
    const body = await req.json().catch(() => ({}))

    const parsed = UpdateEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    await updateEmployeeMaster(empId, parsed.data, admin.username, clientIP)
    return NextResponse.json({
      success: true,
      message: "Employee details updated successfully.",
    })
  } catch (error) {
    console.error("PUT /api/admin/employees/[id] error:", error)
    return NextResponse.json({ error: "Failed to update employee details." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { id } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const empId = id
    const body = await req.json().catch(() => ({}))

    const active = body.active === "1" || body.active === true ? "1" : "0"
    await setEmployeeMasterStatus(empId, active, admin.username, clientIP)

    return NextResponse.json({
      success: true,
      message: active === "1" ? "Employee account activated." : "Employee record deactivated / retired.",
      active,
    })
  } catch (error) {
    console.error("PATCH /api/admin/employees/[id] error:", error)
    return NextResponse.json({ error: "Failed to update employee status." }, { status: 500 })
  }
}
