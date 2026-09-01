"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookingDetailsModal } from "./BookingDetailsModal"

interface ApprovalItem {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  TRIP_DATE: string
  VEH_REQUESTED: string
  STATUS_APVR?: string
  PURPOSE?: string
  REMARKS_USER?: string
  COMPANY_NAME?: string
  DEPT_USER?: string
  INDENT_DATE?: string
  TRIP_TIME?: string
  DURATION_REQ?: string
  FLIGHT_TRAIN_NO?: string
  OTHER_DETAILS?: string
  REMARKS_APVR?: string
  PASS_DATE_APVR?: string
  VEH_ALLOTTED?: string
  VEHICLE_NO?: string
  DRIVER_NAME?: string
  DRIVER_MOB_NO?: string
  MOB_NO_USER?: string
  REMARKS_TRANS?: string
}

interface ApprovalTableProps {
  items: ApprovalItem[]
  mode: string
  onUpdate: (serialNo?: string, newStatus?: string) => void
}

export function ApprovalTable({ items, mode, onUpdate }: ApprovalTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<ApprovalItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleSerialClick = (booking: ApprovalItem) => {
    setSelectedBooking(booking)
    setIsModalOpen(true)
  }

  const handleApproval = async (serial: string, status: "APVD" | "REJ", remarks?: string) => {
    setLoading(serial)
    try {
      const res = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, status, remarks: remarks || "" }),
      })

      const result = await res.json()

      if (res.ok) {
        console.log(`Successfully ${status === 'APVD' ? 'approved' : 'rejected'} booking ${serial}`)
        
        // Show success message
        const statusText = status === 'APVD' ? 'approved' : 'rejected'
        alert(`Booking ${serial} has been ${statusText} successfully!`)
        
        setIsModalOpen(false)
        // Call onUpdate with the updated details for optimistic UI update
        onUpdate(serial, status)
      } else {
        console.error("Approval failed:", result.error)
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
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB")
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No {mode} records found.</p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">Serial No</TableHead>
              <TableHead className="font-semibold">Passenger Name</TableHead>
              <TableHead className="font-semibold">Route</TableHead>
              <TableHead className="font-semibold">Trip Date</TableHead>
              <TableHead className="font-semibold">Vehicle</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              {mode === "pending" && <TableHead className="font-semibold">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.SERIAL_NO} className="hover:bg-gray-50">
                <TableCell>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => handleSerialClick(item)}
                  >
                    {item.SERIAL_NO}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{item.PASSENGER_NAME}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {item.TAKE_OFF_FROM} → {item.DESTINATION}
                  </div>
                </TableCell>
                <TableCell>{formatDate(item.TRIP_DATE)}</TableCell>
                <TableCell>{item.VEH_REQUESTED}</TableCell>
                <TableCell>{getStatusBadge(item.STATUS_APVR)}</TableCell>
                {mode === "pending" && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproval(item.SERIAL_NO, "APVD")}
                        disabled={loading === item.SERIAL_NO}
                        className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
                      >
                        {loading === item.SERIAL_NO ? "..." : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproval(item.SERIAL_NO, "REJ")}
                        disabled={loading === item.SERIAL_NO}
                        variant="destructive"
                        className="text-xs px-2 py-1"
                      >
                        {loading === item.SERIAL_NO ? "..." : "Deny"}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApprove={handleApproval}
        showActions={mode === "pending"}
      />
    </>
  )
}
