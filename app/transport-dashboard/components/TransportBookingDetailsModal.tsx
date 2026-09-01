"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export interface TransportBooking {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM?: string
  STARTING_PLACE?: string
  DESTINATION: string
  TRIP_DATE: string
  TRIP_TIME?: string
  VEH_REQUESTED: string
  DURATION_REQ?: string
  PURPOSE?: string
  STATUS_APVR?: string
  PASS_DATE_APVR?: string
  REMARKS_APVR?: string
  INDENT_DATE?: string
  OTHER_DETAILS?: string
  VEH_ALLOTTED?: string
  VEHICLE_NO?: string
  DRIVER_NAME?: string
  DRIVER_MOB_NO?: string
  FLIGHT_TRAIN_NO?: string
  DEPT_USER?: string
  STAFF_NO_USER?: string
  MOB_NO_USER?: string
  STAFF_NO_APVR?: string
  REMARKS_USER?: string
  COMPANY_NAME?: string
  REMARKS_TRANS?: string
  STATUS_TRANS?: string
  [key: string]: unknown
}

export interface TransportVehicleDetails {
  vehicleAllotted?: string
  vehicleNo?: string
  driverName?: string
  driverMobile?: string
}

interface TransportBookingDetailsModalProps {
  booking: TransportBooking | null
  isOpen: boolean
  onClose: () => void
  onTransportAction: (serial: string, status: "PASSED" | "DENIED", vehicleDetails?: TransportVehicleDetails | null, remarks?: string) => void
  showActions: boolean
}

export function TransportBookingDetailsModal({
  booking,
  isOpen,
  onClose,
  onTransportAction,
  showActions,
}: TransportBookingDetailsModalProps) {
  const [vehicleDetails, setVehicleDetails] = useState({
    vehicleAllotted: "",
    vehicleNo: "",
    driverName: "",
    driverMobile: "",
  })
  const [remarks, setRemarks] = useState("")
  const [actionType, setActionType] = useState<"PASSED" | "DENIED" | null>(null)

  if (!booking) return null

  const formatDateTime = (dateStr: string, timeStr?: string) => {
    const date = new Date(dateStr)
    let result = date.toLocaleDateString("en-GB")
    if (timeStr) {
      result += ` at ${timeStr}`
    }
    return result
  }

  const handleAction = (status: "PASSED" | "DENIED") => {
    setActionType(status)
    
    if (status === "PASSED") {
      // For pass action, we need vehicle details
      return
    } else {
      // For deny action, just execute immediately
      onTransportAction(booking.SERIAL_NO, status, null, remarks)
      handleClose()
    }
  }

  const handleConfirmPass = () => {
    onTransportAction(booking.SERIAL_NO, "PASSED", vehicleDetails, remarks)
    handleClose()
  }

  const handleClose = () => {
    setActionType(null)
    setVehicleDetails({
      vehicleAllotted: "",
      vehicleNo: "",
      driverName: "",
      driverMobile: "",
    })
    setRemarks("")
    onClose()
  }

  const getStatusBadge = (statusTrans?: string, statusApvr?: string) => {
    if (statusTrans === "PASS" || statusTrans === "PASSED") {
      return <Badge className="bg-green-100 text-green-800">Passed by Transport</Badge>
    } else if (statusTrans === "DENY" || statusTrans === "DENIED") {
      return <Badge className="bg-red-100 text-red-800">Denied by Transport</Badge>
    } else if (statusApvr === "APVD") {
      return <Badge className="bg-blue-100 text-blue-800">Approved by Manager</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transport Request Details - {booking.SERIAL_NO}</span>
            {getStatusBadge(booking.STATUS_TRANS, booking.STATUS_APVR)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Passenger Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Passenger Information</h3>
            <div className="space-y-2">
              <div><strong>Name:</strong> {booking.PASSENGER_NAME}</div>
              <div><strong>Mobile:</strong> {booking.MOB_NO_USER || "Not provided"}</div>
              <div><strong>Company:</strong> {booking.COMPANY_NAME || "Not specified"}</div>
              <div><strong>Department:</strong> {booking.DEPT_USER || "Not specified"}</div>
            </div>
          </div>

          {/* Trip Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Trip Information</h3>
            <div className="space-y-2">
              <div><strong>From:</strong> {booking.TAKE_OFF_FROM}</div>
              <div><strong>To:</strong> {booking.DESTINATION}</div>
              <div><strong>Date:</strong> {formatDateTime(booking.TRIP_DATE, booking.TRIP_TIME)}</div>
              <div><strong>Duration:</strong> {booking.DURATION_REQ || "Not specified"}</div>
              <div><strong>Vehicle Requested:</strong> {booking.VEH_REQUESTED}</div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Additional Details</h3>
            <div className="space-y-2">
              <div><strong>Purpose:</strong> {booking.PURPOSE || "Not specified"}</div>
              <div><strong>Flight/Train No:</strong> {booking.FLIGHT_TRAIN_NO || "Not applicable"}</div>
              <div><strong>Indent Date:</strong> {booking.INDENT_DATE ? formatDateTime(booking.INDENT_DATE) : "Not specified"}</div>
              <div><strong>Other Details:</strong> {booking.OTHER_DETAILS || "None"}</div>
            </div>
          </div>

          {/* Current Vehicle Assignment (if passed) */}
          {(booking.STATUS_TRANS === "PASSED" || booking.STATUS_TRANS === "PASS") && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Vehicle Assignment</h3>
              <div className="space-y-2">
                <div><strong>Vehicle Allotted:</strong> {booking.VEH_ALLOTTED || "Not specified"}</div>
                <div><strong>Vehicle No:</strong> {booking.VEHICLE_NO || "Not specified"}</div>
                <div><strong>Driver Name:</strong> {booking.DRIVER_NAME || "Not assigned"}</div>
                <div><strong>Driver Mobile:</strong> {booking.DRIVER_MOB_NO || "Not provided"}</div>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Comments</h3>
            <div className="space-y-2">
              <div><strong>User Remarks:</strong> {booking.REMARKS_USER || "No remarks"}</div>
              <div><strong>Manager Remarks:</strong> {booking.REMARKS_APVR || "No remarks"}</div>
              {booking.REMARKS_TRANS && (
                <div><strong>Transport Remarks:</strong> {booking.REMARKS_TRANS}</div>
              )}
            </div>
          </div>

          {/* Vehicle Details Form (for pass action) */}
          {actionType === "PASSED" && (
            <div className="md:col-span-2 space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Vehicle Assignment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicleAllotted">Vehicle Type Allotted</Label>
                  <Input
                    id="vehicleAllotted"
                    value={vehicleDetails.vehicleAllotted}
                    onChange={(e) => setVehicleDetails(prev => ({ ...prev, vehicleAllotted: e.target.value }))}
                    placeholder="e.g., Sedan, SUV, Mini Bus"
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleNo">Vehicle Number</Label>
                  <Input
                    id="vehicleNo"
                    value={vehicleDetails.vehicleNo}
                    onChange={(e) => setVehicleDetails(prev => ({ ...prev, vehicleNo: e.target.value }))}
                    placeholder="e.g., KA 01 AB 1234"
                  />
                </div>
                <div>
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input
                    id="driverName"
                    value={vehicleDetails.driverName}
                    onChange={(e) => setVehicleDetails(prev => ({ ...prev, driverName: e.target.value }))}
                    placeholder="Driver's full name"
                  />
                </div>
                <div>
                  <Label htmlFor="driverMobile">Driver Mobile</Label>
                  <Input
                    id="driverMobile"
                    value={vehicleDetails.driverMobile}
                    onChange={(e) => setVehicleDetails(prev => ({ ...prev, driverMobile: e.target.value }))}
                    placeholder="Driver's mobile number"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Remarks Section */}
          {showActions && (
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="transportRemarks">Transport Remarks (Optional)</Label>
              <Textarea
                id="transportRemarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any remarks or notes..."
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            
            {actionType === "PASSED" ? (
              <Button onClick={handleConfirmPass} className="bg-green-600 hover:bg-green-700">
                Confirm Pass
              </Button>
            ) : (
              <>
                <Button onClick={() => handleAction("PASSED")} className="bg-green-600 hover:bg-green-700">
                  Pass Request
                </Button>
                <Button onClick={() => handleAction("DENIED")} variant="destructive">
                  Deny Request
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}