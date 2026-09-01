import { NextResponse } from "next/server"
import { query } from "@/lib/database"

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Demo setup not available in production" }, { status: 403 })
    }

    // Insert or update test employee
    await query(`
      INSERT INTO "axusers" ("username", "password", "usergroup", "active", "build", "manage", "tools", "email")
      VALUES ('testuser', 'testpass', 'employee', '1', '1', '0', '1', 'testuser@bhel.in')
      ON CONFLICT ("username") DO UPDATE SET
        "password" = EXCLUDED."password",
        "active" = '1';
    `)

    // Insert or update test manager
    await query(`
      INSERT INTO "axusers" ("username", "password", "usergroup", "active", "build", "manage", "tools", "email")
      VALUES ('testmanager', 'managerpass', 'manager', '1', '1', '1', '1', 'manager@bhel.in')
      ON CONFLICT ("username") DO UPDATE SET
        "password" = EXCLUDED."password",
        "manage" = '1',
        "active" = '1';
    `)

    return NextResponse.json({
      success: true,
      message: "Test users created/updated successfully",
      testAccounts: [
        { username: "testuser", password: "testpass", role: "employee" },
        { username: "testmanager", password: "managerpass", role: "manager" },
      ],
    })
  } catch (error) {
    console.error("Setup error:", error)
    return NextResponse.json(
      {
        error: "Failed to setup test data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}