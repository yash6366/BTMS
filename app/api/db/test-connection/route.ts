import { NextResponse } from "next/server"
import { testDatabaseConnection, query } from "@/lib/database"

export async function GET() {
  try {
    const connectionResult = await testDatabaseConnection()

    // Get some sample users for testing
    const sampleUsers = await query(`
      SELECT 
        "username", 
        "usergroup", 
        "build", 
        "manage", 
        "tools", 
        "email",
        "active",
        CASE 
          WHEN "password_hash" IS NOT NULL THEN 'bcrypt_hash_active'
          WHEN "password" IS NOT NULL AND "password" != '' THEN 'legacy_password_present'
          WHEN "pwd" IS NOT NULL AND "pwd" != '' THEN 'legacy_pwd_present'
          ELSE 'no_password_found'
        END as password_status
      FROM "axusers" 
      WHERE "username" IS NOT NULL 
      ORDER BY "username"
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      details: {
        ...connectionResult,
        sampleUsers: sampleUsers.rows.map((user) => ({
          username: user.username,
          usergroup: user.usergroup,
          permissions: {
            build: user.build,
            manage: user.manage,
            tools: user.tools,
          },
          email: user.email,
          active: user.active,
          passwordStatus: user.password_status,
          note: "Password credentials securely protected",
        })),
      },
    })
  } catch (error) {
    console.error("Database connection test failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
