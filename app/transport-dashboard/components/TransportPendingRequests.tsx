"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Calendar } from "lucide-react"
import { TransportBookingTable } from "./TransportBookingTable"
import { type TransportBooking } from "./TransportBookingDetailsModal"

export default function TransportPendingRequests() {
  const [bookings, setBookings] = useState<TransportBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchBookings = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const url = forceRefresh 
        ? `/api/transport/bookings?status=approved&_t=${Date.now()}` 
        : "/api/transport/bookings?status=approved"
        
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      
      const data = await res.json()

      if (res.ok && Array.isArray(data.bookings)) {
        setBookings(data.bookings)
        console.log("Transport pending bookings fetched:", data.bookings.length)
      } else {
        console.error("Failed to fetch transport bookings:", data.error || "Unexpected response")
      }
    } catch (error) {
      console.error("Error fetching transport bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleBookingUpdate = async () => {
    // Refresh the bookings list after an action
    setTimeout(async () => {
      await fetchBookings(true)
    }, 500)
  }

  useEffect(() => {
    fetchBookings()
  }, [])

  const filtered = bookings.filter((item) => {
    if (
      search &&
      !item.SERIAL_NO.toLowerCase().includes(search.toLowerCase()) &&
      !item.PASSENGER_NAME.toLowerCase().includes(search.toLowerCase())
    ) {
      return false
    }

    const date = new Date(item.TRIP_DATE)
    if (startDate && date < new Date(startDate)) return false
    if (endDate && date > new Date(endDate)) return false

    return true
  })

  const downloadCSV = () => {
    const rows = [
      ["Serial No", "Passenger Name", "Pickup", "Destination", "Trip Date", "Vehicle Requested", "Status", "Approved Date"],
      ...filtered.map((b) => [
        b.SERIAL_NO,
        b.PASSENGER_NAME,
        b.TAKE_OFF_FROM,
        b.DESTINATION,
        format(new Date(b.TRIP_DATE), "yyyy-MM-dd"),
        b.VEH_REQUESTED,
        "Approved by Manager",
        b.PASS_DATE_APVR ? format(new Date(b.PASS_DATE_APVR), "yyyy-MM-dd") : "",
      ]),
    ]
    const csvContent = `data:text/csv;charset=utf-8,${rows.map((r) => r.join(",")).join("\n")}`
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(csvContent))
    link.setAttribute("download", `transport_pending_requests_${format(new Date(), "yyyy-MM-dd")}.csv`)
    link.click()
  }

  if (loading) {
    return <div className="p-8 text-gray-600">Loading pending transport requests...</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="transport-pending-requests">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Pending Transport Requests</span>
            <div className="text-sm text-gray-500">
              Bookings approved by manager awaiting transport action
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Approval Flow</h4>
            <div className="flex items-center text-sm text-blue-800">
              <span className="bg-yellow-100 px-2 py-1 rounded mr-2">1. Employee Submits</span>
              <span className="mx-1">→</span>
              <span className="bg-green-100 px-2 py-1 rounded mr-2">2. Manager Approved</span>
              <span className="mx-1">→</span>
              <span className="bg-blue-100 px-2 py-1 rounded font-medium">3. Transport Action Required</span>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              These requests have been approved by the manager and are now awaiting your approval or rejection with vehicle assignment.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by Serial No or Passenger Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
              <span className="text-gray-400">to</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
            </div>

            <Button onClick={downloadCSV} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filtered.length} of {bookings.length} pending requests
      </div>

      {/* Pending Requests Table */}
      <TransportBookingTable 
        bookings={filtered} 
        mode="pending" 
        onUpdate={handleBookingUpdate} 
      />
    </div>
  )
}