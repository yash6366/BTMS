"use client"

type ApprovalItem = {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  TRIP_DATE: string
  VEH_REQUESTED: string
  STATUS_APVR?: string
}

export function ApprovalList({ items, mode }: { items: ApprovalItem[]; mode: string }) {
  const handleDecision = async (serial: string, decision: "APVD" | "REJ") => {
    try {
      console.log(`Making approval request for ${serial} with decision ${decision}`)
      
      let remarks = decision === "APVD" ? "Approved by manager" : "Rejected by manager"
      
      // For rejection, ask for a reason
      if (decision === "REJ") {
        const rejectionReason = prompt("Please provide a reason for rejection:", "")
        if (rejectionReason === null) {
          // User cancelled
          return
        }
        remarks = rejectionReason.trim() || "Rejected by manager"
      }
      
      const requestBody = {
        serial,
        status: decision,
        remarks
      }
      
      console.log("Request body:", requestBody)
      
      const res = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("Response status:", res.status)
      const responseData = await res.json()
      console.log("Response data:", responseData)

      if (res.ok) {
        alert(`✅ Booking ${serial} ${decision === "APVD" ? "approved" : "rejected"} successfully!`)
        window.location.reload()
      } else {
        console.error("API Error:", responseData)
        alert(`❌ Failed to update approval status: ${responseData.error || responseData.details || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Network error:", error)
      alert(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  if (items.length === 0) {
    return <p className="text-gray-600">No {mode} records found.</p>
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.SERIAL_NO} className="border p-4 rounded bg-white shadow-sm">
          <div className="font-semibold text-blue-900">{item.PASSENGER_NAME} ({item.SERIAL_NO})</div>
          <div className="text-sm text-gray-700">{item.TAKE_OFF_FROM} ➔ {item.DESTINATION}</div>
          <div className="text-sm">Date: {new Date(item.TRIP_DATE).toLocaleDateString()}</div>
          <div className="text-sm mb-2">Vehicle: {item.VEH_REQUESTED}</div>

          {mode === "pending" && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleDecision(item.SERIAL_NO, "APVD")}
                className="bg-green-600 text-white px-3 py-1 text-sm rounded"
              >
                Approve
              </button>
              <button
                onClick={() => handleDecision(item.SERIAL_NO, "REJ")}
                className="bg-red-600 text-white px-3 py-1 text-sm rounded"
              >
                Reject
              </button>
            </div>
          )}

          {mode !== "pending" && (
            <div className={`text-sm font-medium mt-2 ${mode === "approved" ? "text-green-600" : "text-red-600"}`}>
              {mode === "approved" ? "Approved" : "Rejected"}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
