"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApprovalTable } from "@/components/ApprovalTable"
import { useAuth } from "@/hooks/use-auth"
import { Download, Search, Calendar } from "lucide-react"

interface ApprovalItem {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  VEH_REQUESTED: string
  TRIP_DATE: string
  STATUS_APVR?: string
  PURPOSE?: string
}

export default function ApprovalDashboard() {
  const { user, isLoading } = useAuth()
  const [approvals, setApprovals] = useState<ApprovalItem[]>([])
  const [activeTab, setActiveTab] = useState("pending")
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isApprover, setIsApprover] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  const fetchApprovals = async (forceRefresh = false) => {
    setDataLoading(true)
    try {
      // Add cache-busting parameter to ensure fresh data
      const url = forceRefresh 
        ? `/api/approvals?_t=${Date.now()}` 
        : "/api/approvals"
        
      const res = await fetch(url, {
        cache: 'no-store', // Prevent caching
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      const data = await res.json()

      if (res.ok && Array.isArray(data.approvals)) {
        setApprovals(data.approvals)
        console.log("Approvals fetched:", data.approvals.length)
      } else {
        console.error("Failed to fetch approvals:", data.error || "Unexpected response")
      }
    } catch (error) {
      console.error("Error fetching approvals:", error)
    } finally {
      setDataLoading(false)
    }
  }

  const handleApprovalUpdate = async (serialNo?: string, newStatus?: string) => {
    // Optimistically update the UI immediately if we have the details
    if (serialNo && newStatus) {
      setApprovals(prevApprovals => 
        prevApprovals.map(approval => 
          approval.SERIAL_NO === serialNo 
            ? { ...approval, STATUS_APVR: newStatus }
            : approval
        )
      )
      
      // Optional: Auto-switch to the relevant tab to show the updated item
      if (newStatus === "APVD" && activeTab === "pending") {
        console.log("Switching to approved tab to show newly approved item")
        setTimeout(() => setActiveTab("approved"), 1000)
      } else if (newStatus === "REJ" && activeTab === "pending") {
        console.log("Switching to rejected tab to show newly rejected item")
        setTimeout(() => setActiveTab("rejected"), 1000)
      }
    }
    
    // Then fetch fresh data from the backend with a small delay
    setTimeout(async () => {
      await fetchApprovals(true)
    }, 500)
  }

  useEffect(() => {
    const checkApprover = async () => {
      try {
        const res = await fetch("/api/approvals/check")
        const result = await res.json()
        if (res.ok && result.isApprover) {
          setIsApprover(true)
        }
      } catch (err) {
        console.error("Approver check failed", err)
      }
    }

    if (user) {
      checkApprover()
      fetchApprovals()
    }
  }, [user])

  const filtered = approvals.filter((item) => {
    const status = item.STATUS_APVR

    if (activeTab === "pending" && status !== "OPEN") return false
    if (activeTab === "approved" && status !== "APVD") return false
    if (activeTab === "rejected" && status !== "REJ") return false

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

  const pendingCount = approvals.filter((item) => item.STATUS_APVR === "OPEN").length
  const approvedCount = approvals.filter((item) => item.STATUS_APVR === "APVD").length
  const rejectedCount = approvals.filter((item) => item.STATUS_APVR === "REJ").length

  const downloadCSV = () => {
    const rows = [
      ["Serial No", "Passenger Name", "Pickup", "Destination", "Trip Date", "Vehicle", "Status", "Purpose"],
      ...filtered.map((b) => [
        b.SERIAL_NO,
        b.PASSENGER_NAME,
        b.TAKE_OFF_FROM,
        b.DESTINATION,
        format(new Date(b.TRIP_DATE), "yyyy-MM-dd"),
        b.VEH_REQUESTED,
        b.STATUS_APVR || "Pending",
        b.PURPOSE || "",
      ]),
    ]
    const csvContent = `data:text/csv;charset=utf-8,${rows.map((r) => r.join(",")).join("\n")}`
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(csvContent))
    link.setAttribute("download", `${activeTab}_approvals_${format(new Date(), "yyyy-MM-dd")}.csv`)
    link.click()
  }

  if (isLoading || dataLoading) {
    return <div className="p-8 text-gray-600">Loading...</div>
  }

  if (!user || !isApprover) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 text-lg font-semibold">Unauthorized Access</div>
        <p className="text-gray-600 mt-2">You are not authorized to access the approval dashboard.</p>
      </div>
    )
  }

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="approval-dashboard">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Cab Booking Approvals</span>
            <div className="text-sm text-gray-500">
              Logged in as: <strong>{user.username}</strong>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeTab === "pending" ? "default" : "outline"}
          onClick={() => setActiveTab("pending")}
          className="relative"
        >
          Pending Requests
          {pendingCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingCount}</span>
          )}
        </Button>
        <Button
          variant={activeTab === "approved" ? "default" : "outline"}
          onClick={() => setActiveTab("approved")}
          className="relative"
        >
          Approved
          {approvedCount > 0 && (
            <span className="ml-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">{approvedCount}</span>
          )}
        </Button>
        <Button
          variant={activeTab === "rejected" ? "default" : "outline"}
          onClick={() => setActiveTab("rejected")}
          className="relative"
        >
          Rejected
          {rejectedCount > 0 && (
            <span className="ml-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full">{rejectedCount}</span>
          )}
        </Button>
      </div>

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

            <Button onClick={downloadCSV} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        Showing {filtered.length} of {approvals.length} records
      </div>

      {/* Approval List */}
      <ApprovalTable items={filtered} mode={activeTab} onUpdate={handleApprovalUpdate} />
    </main>
  )
}
