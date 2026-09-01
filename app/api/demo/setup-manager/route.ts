import { NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Demo setup not available in production" }, { status: 403 })
    }

    const body = await request.json()
    const { username, password = "bhel123", usergroup = "manager", manage = "1", active = "1", email } = body

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    await query(
      `
      INSERT INTO "axusers" ("username", "password", "usergroup", "active", "build", "manage", "tools", "email")
      VALUES ($1, $2, $3, $4, '1', $5, '1', $6)
      ON CONFLICT ("username") DO UPDATE SET
        "password" = EXCLUDED."password",
        "usergroup" = EXCLUDED."usergroup",
        "active" = EXCLUDED."active",
        "manage" = EXCLUDED."manage";
    `,
      [username, password, usergroup, active, manage, email || `${username}@bhel.in`]
    )

    return NextResponse.json({
      success: true,
      message: `User ${username} configured as manager successfully`,
      user: { username, password, usergroup, manage, active },
    })
  } catch (error) {
    console.error("Setup manager error:", error)
    return NextResponse.json(
      {
        error: "Failed to setup manager",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}