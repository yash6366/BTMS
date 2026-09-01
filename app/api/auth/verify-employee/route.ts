import { type NextRequest, NextResponse } from "next/server"
import { verifyEmployeeMaster } from "@/lib/auth"
import { EmployeeVerificationSchema, FormValidator } from "@/lib/form-validation"
import { checkRateLimit } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 1. IP-based Rate Limiting
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const rateLimit = checkRateLimit(`verify_${clientIP}`)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many verification attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 60) / 60)} minutes.`,
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      )
    }

    // 2. Parse and validate payload
    const body = await request.json().catch(() => ({}))
    const validation = FormValidator.validateForm(EmployeeVerificationSchema, body)

    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          error: "Invalid input. Please provide a valid Staff Number and official email address.",
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    const { staffNo, officialEmail } = validation.data

    // 3. Verify against authoritative Employee Master Directory
    const result = await verifyEmployeeMaster(staffNo, officialEmail)

    if (!result.verified || !result.employee) {
      return NextResponse.json(
        {
          error: result.message || "Employee verification failed. Please verify your Staff Number and official BHEL email with the IT Directory.",
          alreadyRegistered: result.alreadyRegistered || false,
        },
        { status: result.alreadyRegistered ? 409 : 404 }
      )
    }

    // 4. Return verified profile (read-only canonical attributes)
    return NextResponse.json({
      success: true,
      verified: true,
      employee: result.employee,
    })
  } catch (error) {
    console.error("POST /api/auth/verify-employee error:", error)
    return NextResponse.json(
      {
        error: "Verification service temporarily unavailable. Please try again later or contact BHEL IT Helpdesk.",
      },
      { status: 500 }
    )
  }
}
