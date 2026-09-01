"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Car, Clock, CheckCircle, XCircle, AlertCircle, Download, Loader2 } from "lucide-react"

interface Booking {
  SERIAL_NO: string
  PASSENGER_NAME: string
  STARTING_PLACE: string
  DESTINATION: string
  TRIP_DATE: string
  TRIP_TIME: string
  VEH_REQUESTED: string
  DURATION_REQ: string
  PURPOSE: string
  STATUS_APVR: string
  STATUS_DESCRIPTION: string
  PASS_DATE_APVR: string | null
  REMARKS_APVR: string | null
  INDENT_DATE: string
  OTHER_DETAILS: string | null
  VEH_ALLOTTED: string | null
  VEHICLE_NO: string | null
  DRIVER_NAME: string | null
  DRIVER_MOB_NO: string | null
  FLIGHT_TRAIN_NO: string | null
  TAKE_OFF_FROM: string | null
}

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyBookings()
  }, [])

  const fetchMyBookings = async () => {
    try {
      const response = await fetch("/api/bookings/my-rides")
      if (response.ok) {
        const data = await response.json()
        // Handle both 'bookings' and 'rides' properties for backward compatibility
        setBookings(data.bookings || data.rides || [])
      } else {
        console.error("Failed to fetch bookings")
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'APVD':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>
      case 'REJ':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
      case 'ALLOTTED':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Car className="w-3 h-3 mr-1" />Assigned</Badge>
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>
    }
  }

  const pendingBookings = bookings.filter(booking => booking.STATUS_APVR === 'OPEN')
  const approvedBookings = bookings.filter(booking => booking.STATUS_APVR === 'APVD')
  const completedBookings = bookings.filter(booking => ['REJ', 'ALLOTTED', 'COMPLETED'].includes(booking.STATUS_APVR))

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center">Loading your bookings...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">My Ride Bookings</h2>
        <p className="text-sm text-gray-600">Track your transportation requests and their status.</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="all">All ({bookings.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingBookings.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedBookings.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedBookings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <BookingsList bookings={bookings} getStatusBadge={getStatusBadge} />
        </TabsContent>
        
        <TabsContent value="pending">
          <BookingsList bookings={pendingBookings} getStatusBadge={getStatusBadge} />
        </TabsContent>
        
        <TabsContent value="approved">
          <BookingsList bookings={approvedBookings} getStatusBadge={getStatusBadge} />
        </TabsContent>
        
        <TabsContent value="completed">
          <BookingsList bookings={completedBookings} getStatusBadge={getStatusBadge} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface BookingsListProps {
  bookings: Booking[]
  getStatusBadge: (status: string) => JSX.Element
}

function BookingsList({ bookings, getStatusBadge }: BookingsListProps) {
  const [downloadingSlips, setDownloadingSlips] = useState<Set<string>>(new Set())

  const handleDownloadResponseSlip = async (serialNo: string) => {
    try {
      setDownloadingSlips(prev => new Set(prev).add(serialNo))
      
      const response = await fetch(`/api/download-response/${serialNo}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error(`Failed to generate response slip: ${response.status}`)
      }
      
      // Get the HTML content directly
      const htmlContent = await response.text()
      
      // Create blob with proper MIME type
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const downloadUrl = window.URL.createObjectURL(blob)
      
      // Create and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `booking-receipt-${serialNo}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      window.URL.revokeObjectURL(downloadUrl)
      
      // Show success feedback
      alert(`Receipt for booking ${serialNo} downloaded successfully!`)
      
    } catch (error) {
      console.error('Download error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to download receipt. Error: ${errorMessage}`)
    } finally {
      setDownloadingSlips(prev => {
        const newSet = new Set(prev)
        newSet.delete(serialNo)
        return newSet
      })
    }
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Car className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">No bookings found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <Card key={booking.SERIAL_NO} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg">{booking.SERIAL_NO}</h3>
                <p className="text-sm text-gray-600">Booked on: {booking.INDENT_DATE}</p>
              </div>
              {getStatusBadge(booking.STATUS_APVR)}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-medium">Passenger:</span>
                <p className="text-gray-700">{booking.PASSENGER_NAME}</p>
              </div>
              <div>
                <span className="font-medium">Trip Date:</span>
                <p className="text-gray-700">{booking.TRIP_DATE} at {booking.TRIP_TIME}</p>
              </div>
              <div>
                <span className="font-medium">Vehicle:</span>
                <p className="text-gray-700">{booking.VEH_REQUESTED}</p>
              </div>
              <div>
                <span className="font-medium">From:</span>
                <p className="text-gray-700">{booking.STARTING_PLACE}</p>
              </div>
              <div>
                <span className="font-medium">To:</span>
                <p className="text-gray-700">{booking.DESTINATION}</p>
              </div>
              <div>
                <span className="font-medium">Duration:</span>
                <p className="text-gray-700">{booking.DURATION_REQ} hours</p>
              </div>
            </div>

            {booking.PURPOSE && (
              <div className="mt-3 text-sm">
                <span className="font-medium">Purpose:</span>
                <p className="text-gray-700">{booking.PURPOSE}</p>
              </div>
            )}

            {booking.STATUS_APVR === 'REJ' && booking.REMARKS_APVR && (
              <div className="mt-3 p-3 bg-red-50 rounded-md">
                <span className="text-sm font-medium text-red-800">Rejection Reason:</span>
                <p className="text-sm text-red-700 mt-1">{booking.REMARKS_APVR}</p>
              </div>
            )}

            {booking.STATUS_APVR === 'APVD' && (
              <div className="mt-3 p-3 bg-green-50 rounded-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-medium text-green-800">Status:</span>
                    <p className="text-sm text-green-700 mt-1">
                      Approved on {booking.PASS_DATE_APVR}
                      {booking.REMARKS_APVR && ` - ${booking.REMARKS_APVR}`}
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleDownloadResponseSlip(booking.SERIAL_NO)}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 text-xs"
                    title="Download Approved Booking Slip"
                    disabled={downloadingSlips.has(booking.SERIAL_NO)}
                  >
                    {downloadingSlips.has(booking.SERIAL_NO) ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {downloadingSlips.has(booking.SERIAL_NO) ? 'Loading...' : 'Get Receipt'}
                  </Button>
                </div>
              </div>
            )}

            {booking.VEH_ALLOTTED && (
              <div className="mt-3 p-3 bg-blue-50 rounded-md">
                <div className="text-sm">
                  <span className="font-medium text-blue-800">Vehicle Details:</span>
                  <div className="mt-1 text-blue-700">
                    <p>Vehicle: {booking.VEH_ALLOTTED} ({booking.VEHICLE_NO})</p>
                    {booking.DRIVER_NAME && (
                      <p>Driver: {booking.DRIVER_NAME} - {booking.DRIVER_MOB_NO}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}