"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, MapPin, Car, User, Phone } from "lucide-react"

interface BookingDetails {
  SERIAL_NO: string
  PASSENGER_NAME: string
  COMPANY_NAME?: string
  DEPT_USER?: string
  INDENT_DATE?: string
  TRIP_DATE: string
  TRIP_TIME?: string
  DURATION_REQ?: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  FLIGHT_TRAIN_NO?: string
  VEH_REQUESTED: string
  OTHER_DETAILS?: string
  PURPOSE?: string
  REMARKS_USER?: string
  STATUS_APVR?: string
  PASS_DATE_APVR?: string
  REMARKS_APVR?: string
  VEH_ALLOTTED?: string
  VEHICLE_NO?: string
  DRIVER_NAME?: string
  DRIVER_MOB_NO?: string
  MOB_NO_USER?: string
  REMARKS_TRANS?: string
}

interface BookingDetailsModalProps {
  booking: BookingDetails | null
  isOpen: boolean
  onClose: () => void
  onApprove?: (serial: string, status: "APVD" | "REJ", remarks?: string) => void
  showActions?: boolean
}

export function BookingDetailsModal({
  booking,
  isOpen,
  onClose,
  onApprove,
  showActions = false,
}: BookingDetailsModalProps) {
  if (!booking) return null

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-GB")
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return "N/A"
    return timeStr
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "APVD":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case "REJ":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending With Approver</Badge>
    }
  }

  const isPending = !booking.STATUS_APVR || booking.STATUS_APVR === "OPEN"
  const isApproved = booking.STATUS_APVR === "APVD"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Booking Details - {booking.SERIAL_NO}</span>
            {getStatusBadge(booking.STATUS_APVR)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Passenger Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Passenger Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong>Name:</strong> {booking.PASSENGER_NAME}
              </div>
              {booking.COMPANY_NAME && (
                <div>
                  <strong>Company:</strong> {booking.COMPANY_NAME}
                </div>
              )}
              {booking.DEPT_USER && (
                <div>
                  <strong>Department:</strong> {booking.DEPT_USER}
                </div>
              )}
              {booking.MOB_NO_USER && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  <strong>Mobile:</strong> {booking.MOB_NO_USER}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Trip Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Trip Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {booking.INDENT_DATE && (
                <div>
                  <strong>Indent Date:</strong> {formatDate(booking.INDENT_DATE)}
                </div>
              )}
              <div>
                <strong>Trip Date:</strong> {formatDate(booking.TRIP_DATE)}
              </div>
              {booking.TRIP_TIME && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <strong>Trip Time:</strong> {formatTime(booking.TRIP_TIME)}
                </div>
              )}
              {booking.DURATION_REQ && (
                <div>
                  <strong>Duration:</strong> {booking.DURATION_REQ}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Route Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Route Details
            </h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <strong>Pick-Up From:</strong> {booking.TAKE_OFF_FROM} <strong>To:</strong> {booking.DESTINATION}
              </div>
              {booking.TRIP_TIME && (
                <div>
                  <strong>Pick-Up Time:</strong> {formatTime(booking.TRIP_TIME)}
                </div>
              )}
              {booking.FLIGHT_TRAIN_NO && (
                <div>
                  <strong>Train No:</strong> {booking.FLIGHT_TRAIN_NO}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Vehicle Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong>Selected Car:</strong> {booking.VEH_REQUESTED}
              </div>
              {isApproved && booking.VEH_ALLOTTED && (
                <div>
                  <strong>Vehicle Allotted:</strong> {booking.VEH_ALLOTTED}
                </div>
              )}
              {isApproved && booking.VEHICLE_NO && (
                <div>
                  <strong>Vehicle No:</strong> {booking.VEHICLE_NO}
                </div>
              )}
              {isApproved && booking.DRIVER_NAME && (
                <div>
                  <strong>Driver Name:</strong> {booking.DRIVER_NAME}
                </div>
              )}
              {isApproved && booking.DRIVER_MOB_NO && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  <strong>Driver Mobile:</strong> {booking.DRIVER_MOB_NO}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Additional Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Additional Information</h3>
            <div className="space-y-2 text-sm">
              {booking.PURPOSE && (
                <div>
                  <strong>Purpose:</strong> {booking.PURPOSE}
                </div>
              )}
              {booking.OTHER_DETAILS && booking.OTHER_DETAILS !== "null" && (
                <div>
                  <strong>Other Details:</strong> {booking.OTHER_DETAILS}
                </div>
              )}
              {booking.REMARKS_USER && (
                <div>
                  <strong>Remarks:</strong> {booking.REMARKS_USER}
                </div>
              )}
            </div>
          </div>

          {/* Approval Information */}
          {(isApproved || booking.STATUS_APVR === "REJ") && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Approval Information</h3>
                <div className="space-y-2 text-sm">
                  {booking.PASS_DATE_APVR && (
                    <div>
                      <strong>Approver Pass Date:</strong> {formatDate(booking.PASS_DATE_APVR)}
                    </div>
                  )}
                  {booking.REMARKS_APVR && (
                    <div>
                      <strong>Approver Remarks:</strong> {booking.REMARKS_APVR}
                    </div>
                  )}
                  {booking.REMARKS_TRANS && (
                    <div>
                      <strong>Transport Remarks:</strong> {booking.REMARKS_TRANS}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Action Buttons for Pending Items */}
          {isPending && showActions && onApprove && (
            <>
              <Separator />
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => onApprove(booking.SERIAL_NO, "APVD")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Accept
                </Button>
                <Button onClick={() => onApprove(booking.SERIAL_NO, "REJ")} variant="destructive">
                  Deny
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
