import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/secure-auth"

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    
    if (!user) {
      return NextResponse.json({ isApprover: false }, { status: 401 })
    }

    // Check if user has manager permissions
    const isApprover = user.permissions?.manage === true || 
                      user.usergroup?.toLowerCase().includes("manager") ||
                      user.usergroup?.toLowerCase().includes("admin")

    return NextResponse.json({ isApprover })
  } catch (error) {
    console.error("Approver check error:", error)
    return NextResponse.json({ isApprover: false }, { status: 500 })
  }
}
