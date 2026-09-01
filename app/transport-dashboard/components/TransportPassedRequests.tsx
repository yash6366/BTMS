"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Calendar } from "lucide-react"
import { TransportBookingTable } from "./TransportBookingTable"
import { type TransportBooking } from "./TransportBookingDetailsModal"

export default function TransportPassedRequests() {
  const [bookings, setBookings] = useState<TransportBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchBookings = async (forceRefresh = false) => {
    setLoading(true)
    try {
      const url = forceRefresh 
        ? `/api/transport/bookings?status=passed&_t=${Date.now()}` 
        : "/api/transport/bookings?status=passed"
        
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
        console.log("Transport passed bookings fetched:", data.bookings.length)
      } else {
        console.error("Failed to fetch transport passed bookings:", data.error || "Unexpected response")
      }
    } catch (error) {
      console.error("Error fetching transport passed bookings:", error)
    } finally {
      setLoading(false)
    }
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
      ["Serial No", "Passenger Name", "Pickup", "Destination", "Trip Date", "Vehicle Allotted", "Vehicle No", "Driver Name", "Driver Mobile", "Pass Date"],
      ...filtered.map((b) => [
        b.SERIAL_NO,
        b.PASSENGER_NAME,
        b.TAKE_OFF_FROM,
        b.DESTINATION,
        format(new Date(b.TRIP_DATE), "yyyy-MM-dd"),
        b.VEH_ALLOTTED || "",
        b.VEHICLE_NO || "",
        b.DRIVER_NAME || "",
        b.DRIVER_MOB_NO || "",
        b.PASS_DATE_APVR ? format(new Date(b.PASS_DATE_APVR), "yyyy-MM-dd") : "",
      ]),
    ]
    const csvContent = `data:text/csv;charset=utf-8,${rows.map((r) => r.join(",")).join("\n")}`
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(csvContent))
    link.setAttribute("download", `transport_passed_requests_${format(new Date(), "yyyy-MM-dd")}.csv`)
    link.click()
  }

  if (loading) {
    return <div className="p-8 text-gray-600">Loading passed transport requests...</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="transport-passed-requests">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Passed Transport Requests</span>
            <div className="text-sm text-gray-500">
              Bookings that have been passed by transport
            </div>
          </CardTitle>
        </CardHeader>
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
        Showing {filtered.length} of {bookings.length} passed requests
      </div>

      {/* Passed Requests Table */}
      <TransportBookingTable 
        bookings={filtered} 
        mode="passed" 
        onUpdate={() => {}} // No update actions needed for passed requests
      />
    </div>
  )
}