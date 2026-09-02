import { type NextRequest, NextResponse } from "next/server"
import { AdminUserService } from "@/lib/admin-user-service"
import { requireAdminUser } from "@/lib/secure-auth"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter"
import { getOrGenerateCorrelationId, createSafeErrorResponse } from "@/lib/logger"
import { z } from "zod"

export const dynamic = "force-dynamic"

const ProvisionUserSchema = z.object({
  empId: z.string().trim().min(1, "Staff ID is required").max(50),
  role: z.enum(["employee", "manager", "transport", "admin"]).default("employee"),
})

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

    // Rate limit: 10 account provisions per minute per admin actor
    const rl = await checkRateLimit(`admin:provision:${admin.username.toLowerCase()}`, 10, 60000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many provisioning requests. Please try again in ${rl.retryAfterSeconds} seconds.`,
          correlationId,
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rl),
            "X-Correlation-ID": correlationId,
          },
        }
      )
    }

    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const parsed = ProvisionUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten().fieldErrors, correlationId },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    const result = await AdminUserService.provisionUserAccount(
      parsed.data.empId,
      parsed.data.role,
      admin.username,
      clientIP
    )

    return NextResponse.json(
      {
        success: true,
        username: result.username,
        temporaryPassword: result.temporaryPassword,
        message: result.message,
        correlationId,
      },
      {
        headers: {
          ...getRateLimitHeaders(rl),
          "X-Correlation-ID": correlationId,
        },
      }
    )
  } catch (error) {
    return createSafeErrorResponse(error, correlationId)
  }
}
