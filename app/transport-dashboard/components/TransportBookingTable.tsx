"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TransportBookingDetailsModal, type TransportVehicleDetails, type TransportBooking } from "./TransportBookingDetailsModal"

interface TransportBookingTableProps {
  bookings: TransportBooking[]
  mode: "pending" | "passed" | string
  onUpdate: () => void
}

export function TransportBookingTable({
  bookings,
  mode,
  onUpdate,
}: TransportBookingTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<TransportBooking | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleSerialClick = (booking: TransportBooking) => {
    setSelectedBooking(booking)
    setIsModalOpen(true)
  }

  const handleTransportAction = async (serial: string, status: "PASSED" | "DENIED", vehicleDetails?: TransportVehicleDetails | null, remarks?: string) => {
    setLoading(serial)
    try {
      const res = await fetch("/api/transport/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          serial, 
          status, 
          vehicleDetails: vehicleDetails || {},
          remarks: remarks || "" 
        }),
      })

      const result = await res.json()

      if (res.ok) {
        console.log(`Successfully ${status.toLowerCase()} transport request ${serial}`)
        
        const statusText = status === 'PASSED' ? 'passed' : 'denied'
        alert(`Transport request ${serial} has been ${statusText} successfully!`)
        
        setIsModalOpen(false)
        onUpdate() // Refresh the list
      } else {
        console.error("Transport action failed:", result.error)
        alert(result.error || "Failed to update transport status.")
      }
    } catch (error) {
      console.error("Error updating transport status:", error)
      alert("Failed to update transport status.")
    } finally {
      setLoading(null)
    }
  }

  const getTransportStatusBadge = (statusTrans?: string, statusApvr?: string) => {
    if (statusTrans === "PASSED") {
      return <Badge className="bg-green-100 text-green-800">Passed</Badge>
    } else if (statusTrans === "DENIED") {
      return <Badge className="bg-red-100 text-red-800">Denied</Badge>
    } else if (statusApvr === "APVD") {
      return <Badge className="bg-blue-100 text-blue-800">Approved by Manager</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB")
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No {mode} transport requests found.</p>
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
              <TableHead className="font-semibold">Vehicle Requested</TableHead>
              {mode === "passed" && <TableHead className="font-semibold">Vehicle Allotted</TableHead>}
              {mode === "passed" && <TableHead className="font-semibold">Driver</TableHead>}
              <TableHead className="font-semibold">Status</TableHead>
              {mode === "pending" && <TableHead className="font-semibold">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.SERIAL_NO} className="hover:bg-gray-50">
                <TableCell>
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => handleSerialClick(booking)}
                  >
                    {booking.SERIAL_NO}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{booking.PASSENGER_NAME}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {booking.TAKE_OFF_FROM} → {booking.DESTINATION}
                  </div>
                </TableCell>
                <TableCell>{formatDate(booking.TRIP_DATE)}</TableCell>
                <TableCell>{booking.VEH_REQUESTED}</TableCell>
                {mode === "passed" && (
                  <TableCell>{booking.VEH_ALLOTTED || "Not specified"}</TableCell>
                )}
                {mode === "passed" && (
                  <TableCell>
                    <div className="text-sm">
                      {booking.DRIVER_NAME && <div>{booking.DRIVER_NAME}</div>}
                      {booking.DRIVER_MOB_NO && <div className="text-gray-500">{booking.DRIVER_MOB_NO}</div>}
                      {!booking.DRIVER_NAME && !booking.DRIVER_MOB_NO && "Not assigned"}
                    </div>
                  </TableCell>
                )}
                <TableCell>{getTransportStatusBadge(booking.STATUS_TRANS, booking.STATUS_APVR)}</TableCell>
                {mode === "pending" && (
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSerialClick(booking)}
                        disabled={loading === booking.SERIAL_NO}
                        className="bg-green-600 hover:bg-green-700 text-xs px-2 py-1"
                      >
                        {loading === booking.SERIAL_NO ? "..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleTransportAction(booking.SERIAL_NO, "DENIED")}
                        disabled={loading === booking.SERIAL_NO}
                        variant="destructive"
                        className="text-xs px-2 py-1"
                      >
                        {loading === booking.SERIAL_NO ? "..." : "Reject"}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TransportBookingDetailsModal
        booking={selectedBooking}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTransportAction={handleTransportAction}
        showActions={mode === "pending"}
      />
    </>
  )
}