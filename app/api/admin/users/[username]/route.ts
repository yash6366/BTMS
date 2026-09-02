import { type NextRequest, NextResponse } from "next/server"
import { AdminUserService } from "@/lib/admin-user-service"
import { requireAdminUser } from "@/lib/secure-auth"
import { z } from "zod"

export const dynamic = "force-dynamic"

const UpdateUserSchema = z.object({
  role: z.enum(["employee", "manager", "transport", "admin"]).optional(),
  build: z.boolean().optional(),
  manage: z.boolean().optional(),
  tools: z.boolean().optional(),
  reportingTo: z.string().nullable().optional(),
  active: z.union([z.boolean(), z.enum(["0", "1"])]).optional().transform((val) => {
    if (val === undefined) return undefined
    return val === true || val === "1"
  }),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized. Administrator privileges required." }, { status: 403 })
    }

    const { username } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await AdminUserService.updateUser(username, parsed.data, admin.username, clientIP)

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.updatedUser,
    })
  } catch (error) {
    console.error("PATCH /api/admin/users/[username] error:", error)
    const msg = error instanceof Error ? error.message : "Internal error"

    if (msg === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User account not found." }, { status: 404 })
    }
    if (msg.startsWith("CANNOT_DEACTIVATE_SELF") || msg.startsWith("CANNOT_DEMOTE_SELF") || msg.startsWith("CANNOT_REMOVE_LAST_ADMIN")) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update user account details." }, { status: 500 })
  }
}
