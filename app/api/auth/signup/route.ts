import { type NextRequest, NextResponse } from "next/server"
import { registerEmployeeAccount } from "@/lib/auth"
import { RegistrationSchema, FormValidator } from "@/lib/form-validation"
import { checkRateLimit } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 1. IP-based Rate Limiting for Registration
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const rateLimit = checkRateLimit(`signup_${clientIP}`)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 60) / 60)} minutes.`,
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      )
    }

    // 2. Parse and validate input payload
    const body = await request.json().catch(() => ({}))
    const validation = FormValidator.validateForm(RegistrationSchema, body)

    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          error: "Registration validation failed. Please check the provided information.",
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    const { staffNo, officialEmail, mobile, password, requestedRole, reportingTo } = validation.data

    // 3. Execute atomic account registration with server-controlled RBAC & master verification
    try {
      const result = await registerEmployeeAccount({
        staffNo,
        officialEmail,
        mobile,
        password,
        requestedRole,
        reportingTo,
        clientIP,
      })

      return NextResponse.json({
        success: true,
        staffNo: result.staffNo,
        status: result.status,
        requestedRole: result.requestedRole,
        effectiveRole: result.effectiveRole,
        message: result.message,
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "REGISTRATION_ERROR"

      if (errorMessage === "ACCOUNT_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            error: "An account already exists for the supplied employee identity. Please sign in or contact support.",
          },
          { status: 409 }
        )
      }

      if (errorMessage === "EMPLOYEE_VERIFICATION_FAILED") {
        return NextResponse.json(
          {
            error: "Employee identity verification failed. Please check your Staff Number and official email.",
          },
          { status: 400 }
        )
      }

      console.error("registerEmployeeAccount transaction error:", err)
      return NextResponse.json(
        {
          error: "Registration could not be completed at this time. Please try again later.",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("POST /api/auth/signup error:", error)
    return NextResponse.json(
      {
        error: "Internal server error. Please try again later.",
      },
      { status: 500 }
    )
  }
}
