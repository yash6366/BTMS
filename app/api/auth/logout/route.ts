import { type NextRequest, NextResponse } from "next/server"
import { clearAuthCookies } from "@/lib/secure-auth"

export async function POST(_request: NextRequest) {
  try {
    // Clear authentication cookies
    await clearAuthCookies()
    
    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { error: "Logout failed" }, 
      { status: 500 }
    )
  }
}