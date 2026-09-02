import { type NextRequest, NextResponse } from "next/server"
import { AdminUserService } from "@/lib/admin-user-service"
import { requireAdminUser } from "@/lib/secure-auth"
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter"
import { getOrGenerateCorrelationId, createSafeErrorResponse } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const correlationId = getOrGenerateCorrelationId(req.headers.get("x-correlation-id"))

  try {
    const admin = await requireAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privileges required.", correlationId },
        { status: 403, headers: { "X-Correlation-ID": correlationId } }
      )
    }

    // Rate limit: 5 password resets per minute per admin actor
    const rl = await checkRateLimit(`admin:reset:${admin.username.toLowerCase()}`, 5, 60000)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please try again in ${rl.retryAfterSeconds} seconds.`,
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

    const { username } = await context.params
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"

    const result = await AdminUserService.resetUserPassword(username, admin.username, clientIP)

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        temporaryPassword: result.temporaryPassword,
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
