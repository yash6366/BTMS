"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity,
  Database,
  RefreshCw,
  Server,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react"

export interface HealthData {
  healthy: boolean
  database: {
    responseTime: number
    serverTime: string
    database: string
    user: string
    poolTotal: number
    poolIdle: number
    poolWaiting: number
  }
  inventory: {
    registeredUsers: number
    masterEmployees: number
    totalRequisitions: number
    activeTransportBookings: number
    accessRequests: number
    auditRecords: number
  }
  timestamp: string
}

export function SystemHealthCard() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/health")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setError("Diagnostic probe endpoint returned non-200 status.")
      }
    } catch {
      setError("Failed to reach diagnostic health probe.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  return (
    <Card className="border-gray-200 shadow-xs">
      <CardHeader className="py-3.5 px-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-sm font-bold text-gray-900">
              Live System Health & Neon PostgreSQL Diagnostics
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="h-7 px-2.5 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Run Probe
          </Button>
        </div>
        <CardDescription className="text-xs text-gray-500">
          Real-time server connection telemetry, Neon serverless pool saturation, and data layer health.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Top Stat Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">DB Status</span>
                  {data.healthy ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1 text-emerald-600 inline" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 font-bold">
                      Down
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 flex items-center">
                  <Database className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  {data.database?.database || "neondb"}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Query Latency</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      (data.database?.responseTime || 0) < 50
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : (data.database?.responseTime || 0) < 200
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {data.database?.responseTime || 0} ms
                  </Badge>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  Round-Trip Probe
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Pool Saturation</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700">
                    {data.database?.poolTotal || 0} total
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 flex items-center">
                  <Layers className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  {data.database?.poolIdle || 0} idle / {data.database?.poolWaiting || 0} wait
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Runtime Target</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-bold">
                    Next.js Edge/Node
                  </Badge>
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1.5 flex items-center">
                  <Server className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  v18.6 PostgreSQL
                </div>
              </div>
            </div>

            {/* Inventory Counts */}
            <div className="border border-slate-100 rounded-lg p-3 bg-white space-y-2">
              <span className="text-xs font-semibold text-gray-800 block">
                Primary Database Object Inventory:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.masterEmployees || 0}</div>
                  <div className="text-[10px] text-slate-500">Employees</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.registeredUsers || 0}</div>
                  <div className="text-[10px] text-slate-500">User Accounts</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.totalRequisitions || 0}</div>
                  <div className="text-[10px] text-slate-500">Requisitions</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.activeTransportBookings || 0}</div>
                  <div className="text-[10px] text-slate-500">Fleet Passes</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.accessRequests || 0}</div>
                  <div className="text-[10px] text-slate-500">Role Requests</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div className="text-sm font-bold text-slate-900">{data.inventory?.auditRecords || 0}</div>
                  <div className="text-[10px] text-slate-500">Audit Logs</div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-right">
              Last probe response: {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">Loading diagnostic telemetry...</div>
        )}
      </CardContent>
    </Card>
  )
}
