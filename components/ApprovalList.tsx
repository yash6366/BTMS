"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, MapPin, Car, User } from "lucide-react"

type ApprovalItem = {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  TRIP_DATE: string
  VEH_REQUESTED: string
  STATUS_APVR?: string
  PURPOSE?: string
  REMARKS_USER?: string
}

export function ApprovalList({
  items,
  mode,
  onUpdate,
}: {
  items: ApprovalItem[]
  mode: string
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [remarks, setRemarks] = useState<{ [key: string]: string }>({})

  const handleDecision = async (serial: string, decision: "APVD" | "REJ") => {
    setLoading(serial)
    try {
      const res = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial,
          status: decision,
          remarks: remarks[serial] || "",
        }),
      })

      const result = await res.json()

      if (res.ok) {
        onUpdate()
        setRemarks((prev) => ({ ...prev, [serial]: "" }))
      } else {
        alert(result.error || "Failed to update approval status.")
      }
    } catch (error) {
      console.error("Error updating approval:", error)
      alert("Failed to update approval status.")
    } finally {
      setLoading(null)
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APVD":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case "REJ":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
      case "OPEN":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No {mode} records found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.SERIAL_NO} className="w-full">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                {item.PASSENGER_NAME}
              </CardTitle>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(item.STATUS_APVR)}
                <span className="text-sm text-gray-500">#{item.SERIAL_NO}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  <strong>Route:</strong> {item.TAKE_OFF_FROM} → {item.DESTINATION}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  <strong>Date:</strong> {new Date(item.TRIP_DATE).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  <strong>Vehicle:</strong> {item.VEH_REQUESTED}
                </span>
              </div>

              {item.PURPOSE && (
                <div className="text-sm">
                  <strong>Purpose:</strong> {item.PURPOSE}
                </div>
              )}
            </div>

            {item.REMARKS_USER && (
              <div className="text-sm bg-gray-50 p-3 rounded">
                <strong>User Remarks:</strong> {item.REMARKS_USER}
              </div>
            )}

            {mode === "pending" && (
              <div className="space-y-3 pt-3 border-t">
                <Textarea
                  placeholder="Add remarks (optional)..."
                  value={remarks[item.SERIAL_NO] || ""}
                  onChange={(e) => setRemarks((prev) => ({ ...prev, [item.SERIAL_NO]: e.target.value }))}
                  className="min-h-[80px]"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDecision(item.SERIAL_NO, "APVD")}
                    disabled={loading === item.SERIAL_NO}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading === item.SERIAL_NO ? "Processing..." : "Approve"}
                  </Button>
                  <Button
                    onClick={() => handleDecision(item.SERIAL_NO, "REJ")}
                    disabled={loading === item.SERIAL_NO}
                    variant="destructive"
                  >
                    {loading === item.SERIAL_NO ? "Processing..." : "Reject"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
