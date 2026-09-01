import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/secure-auth"
import { cookies } from "next/headers"

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Debug endpoint not available in production" }, { status: 403 })
    }

    const cookieStore = await cookies()
    const authCookie = cookieStore.get("auth-token")

    const debugInfo = {
      hasCookie: !!authCookie,
      cookieValue: authCookie ? `${authCookie.value.substring(0, 20)}...` : null,
      allCookies: Object.fromEntries(
        cookieStore.getAll().map((cookie) => [cookie.name, `${cookie.value.substring(0, 20)}...`])
      ),
    }

    const user = await getAuthenticatedUser()

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      user,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}