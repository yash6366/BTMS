import { type NextRequest, NextResponse } from "next/server"
import { AdminTransportService } from "@/lib/admin-transport-service"
import { requireAdminUser } from "@/lib/secure-auth"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter"
import { getOrGenerateCorrelationId, createSafeErrorResponse } from "@/lib/logger"
import { z } from "zod"

export const dynamic = "force-dynamic"

const OverrideSchema = z.object({
  reason: z.string().trim().min(3, "A valid reason of at least 3 characters is required for an administrator override.").max(500),
})

export async function POST(req: NextRequest, context: { params: Promise<{ serial: string }> }) {
  const correlationId = getOrGenerateCorrelationId(req.headers.get("x-correlation-id"))

  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privileges required.", correlationId },
        { status: 403, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    // Rate limit: 10 requisition overrides per minute per admin actor
    const rl = await checkRateLimit(`admin:override:${admin.username.toLowerCase()}`, 10, 60000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many override requests. Please try again in ${rl.retryAfterSeconds} seconds.`,
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

    const { serial } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const body = await req.json().catch(() => ({}))

    const parsed = OverrideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parsed.error.flatten().fieldErrors, correlationId },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    const result = await AdminTransportService.overrideRequisitionApproval({
      serialNo: serial,
      reason: parsed.data.reason,
      actorUsername: admin.username,
      clientIP,
    })

    return NextResponse.json(
      {
        success: true,
        serialNo: result.serialNo,
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
