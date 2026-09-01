"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { ApprovalList } from "./components/ApprovalList"
import { useAuth } from "@/hooks/use-auth"

const tabOptions = [
  { label: "Pending Requests", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
]

export interface ManagerApprovalItem {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  TRIP_DATE: string
  STATUS_APVR?: string
  VEH_REQUESTED: string
  [key: string]: unknown
}

export default function ManagerDashboard({ approvals }: { approvals: ManagerApprovalItem[] }) {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState("pending")
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isApprover, setIsApprover] = useState(false)

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
    if (user) checkApprover()
  }, [user])

  const filtered = approvals.filter((item) => {
    const status = item.STATUS_APVR 
    if (activeTab === "pending" && status !== "OPEN") return false
    if (activeTab === "approved" && status !== "APVD") return false
    if (activeTab === "rejected" && status !== "REJ") return false

    if (search && !item.SERIAL_NO.toLowerCase().includes(search.toLowerCase())) return false

    const date = new Date(item.TRIP_DATE)
    if (startDate && date < new Date(startDate)) return false
    if (endDate && date > new Date(endDate)) return false

    return true
  })

  const downloadCSV = () => {
    const rows = [
      ["Serial No", "Passenger Name", "Pickup", "Destination", "Trip Date", "Status"],
      ...filtered.map((b) => [
        b.SERIAL_NO,
        b.PASSENGER_NAME,
        b.TAKE_OFF_FROM,
        b.DESTINATION,
        format(new Date(b.TRIP_DATE), "yyyy-MM-dd"),
        b.STATUS_APVR || "Pending",
      ]),
    ]
    const csvContent = `data:text/csv;charset=utf-8,${rows.map((r) => r.join(",")).join("\n")}`
    const link = document.createElement("a")
    link.setAttribute("href", encodeURI(csvContent))
    link.setAttribute("download", `${activeTab}_approvals.csv`)
    link.click()
  }

  if (isLoading) return <div className="p-8 text-gray-600">Loading...</div>
  if (!user || !isApprover) return <div className="p-8 text-red-600">Unauthorized</div>

  return (
    <main className="p-8 space-y-6">
      <div className="text-sm text-gray-500">Logged in as: <strong>{user.username}</strong></div>

      <div className="flex gap-4">
        {tabOptions.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "default" : "outline"}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-between flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search by Serial No..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded w-64 text-sm"
        />
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border px-2 py-1 rounded text-sm" />
          <span>-</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border px-2 py-1 rounded text-sm" />
          <button onClick={downloadCSV} className="bg-blue-600 text-white text-sm px-3 py-1 rounded">Export CSV</button>
        </div>
      </div>

      <ApprovalList items={filtered} mode={activeTab} />
    </main>
  )
}