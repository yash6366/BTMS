"use client"

import { useState, useEffect } from "react"

interface DatabaseInfo {
  success: boolean
  message: string
  details?: {
    connectionTest: string
    server: string
    database: string
    axusersTable: {
      exists: boolean
      structure?: Array<{
        COLUMN_NAME: string
        DATA_TYPE: string
        IS_NULLABLE: string
        CHARACTER_MAXIMUM_LENGTH: number | null
      }>
      totalUsers?: number
      activeUsers?: number
      message?: string
    }
    timestamp: string
  }
  error?: string
}

export default function DatabaseStatus() {
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkConnection = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/db/test-connection")
      const data = await response.json()
      setDbInfo(data)
    } catch (error) {
      setDbInfo({
        success: false,
        message: "Failed to check database connection",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 className="card-title">Database Connection Status</h3>
        <button
          className="btn btn-secondary"
          onClick={checkConnection}
          disabled={isLoading}
          style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
        >
          {isLoading ? "Checking..." : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <span className="loading"></span>
          Checking database connection...
        </div>
      )}

      {dbInfo && !isLoading && (
        <div>
          <div className={`alert ${dbInfo.success ? "alert-success" : "alert-error"}`}>
            <strong>{dbInfo.success ? "✅" : "❌"}</strong> {dbInfo.message}
          </div>

          {dbInfo.success && dbInfo.details && (
            <div>
              <div className="info-item">
                <strong>Server:</strong> {dbInfo.details.server}
              </div>
              <div className="info-item">
                <strong>Database:</strong> {dbInfo.details.database}
              </div>
              <div className="info-item">
                <strong>Connection Test:</strong>
                <span className={dbInfo.details.connectionTest === "SUCCESS" ? "status-active" : ""}>
                  {dbInfo.details.connectionTest}
                </span>
              </div>
              <div className="info-item">
                <strong>Last Checked:</strong> {new Date(dbInfo.details.timestamp).toLocaleString()}
              </div>

              <hr style={{ margin: "1rem 0", border: "1px solid #eee" }} />

              <h4 style={{ marginBottom: "0.5rem" }}>axusers Table Status:</h4>
              {dbInfo.details.axusersTable.exists ? (
                <div>
                  <div className="info-item">
                    <strong>Table Status:</strong> <span className="status-active">✅ Clear</span>
                  </div>
                  <div className="info-item">
                    <strong>Total Users:</strong> {dbInfo.details.axusersTable.totalUsers}
                  </div>
                  <div className="info-item">
                    <strong>Active Users:</strong> {dbInfo.details.axusersTable.activeUsers}
                  </div>

                  
                </div>
              ) : (
                <div className="alert alert-error">
                  <strong>❌ axusers table not found!</strong>
                  <br />
                  Please create the axusers table with the required structure.
                </div>
              )}
            </div>
          )}

          {dbInfo.error && (
            <div className="alert alert-error">
              <strong>Error Details:</strong>
              <br />
              {dbInfo.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
