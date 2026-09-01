import { query } from "@/lib/database"
import { getAuthenticatedUser } from "@/lib/secure-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return new Response("Unauthorized", { status: 401 })

    const empId = user.username

    const result = await query(
      `
      SELECT 
        "EMP_ID",
        "EMP_FNAME",
        "EMP_MNAME",
        "EMP_LNAME",
        "EMP_DESIGNATION",
        "EMP_EMAIL_ID"
      FROM "EDN_PIS_EMPLOYEE_MASTER_VIEW"
      WHERE "EMP_ID" = $1
    `,
      [empId]
    )

    if (result.rows.length === 0) {
      // Fallback: If not found in employee view, return base user info from session
      return Response.json({
        EMP_ID: empId,
        EMP_FNAME: user.username,
        EMP_MNAME: "",
        EMP_LNAME: "",
        EMP_DESIGNATION: user.role || user.usergroup || "Employee",
        EMP_EMAIL_ID: user.email || "",
        fullName: user.username,
      })
    }

    const empData = result.rows[0]
    const nameParts = [empData.EMP_FNAME, empData.EMP_MNAME, empData.EMP_LNAME].filter((part) => part && part.trim())
    const fullName = nameParts.join(" ")

    return Response.json({
      ...empData,
      fullName: fullName || empData.EMP_LNAME || empData.EMP_FNAME || empId,
    })
  } catch (err) {
    console.error("Profile fetch error:", err)
    const errorMessage = err instanceof Error ? err.message : "Internal server error"
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 })
  }
}
