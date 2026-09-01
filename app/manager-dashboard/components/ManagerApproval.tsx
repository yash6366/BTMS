"use client"

type Approval = {
  SERIAL_NO: string
  PASSENGER_NAME: string
  TAKE_OFF_FROM: string
  DESTINATION: string
  VEH_REQUESTED: string
  TRIP_DATE: string
}

export function ManagerApprovals({ approvals }: { approvals: Approval[] }) {
  const handleDecision = async (serial: string, status: "APVD" | "REJ") => {
    await fetch("/api/approvals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial, status }),
    })
    window.location.reload()
  }

  if (approvals.length === 0) {
    return <p className="text-gray-600">No pending approvals.</p>
  }

  return (
    <div className="space-y-4">
      {approvals.map((item) => (
        <div key={item.SERIAL_NO} className="border p-4 bg-white rounded shadow-sm space-y-1">
          <div className="font-semibold">{item.PASSENGER_NAME} ({item.SERIAL_NO})</div>
          <div className="text-sm text-gray-600">{item.TAKE_OFF_FROM} ➔ {item.DESTINATION}</div>
          <div className="text-sm">Date: {new Date(item.TRIP_DATE).toLocaleDateString()}</div>
          <div className="text-sm">Vehicle: {item.VEH_REQUESTED}</div>
          <div className="flex space-x-2 pt-2">
            <button
              onClick={() => handleDecision(item.SERIAL_NO, "APVD")}
              className="px-3 py-1 text-white bg-green-600 rounded text-sm"
            >
              Approve
            </button>
            <button
              onClick={() => handleDecision(item.SERIAL_NO, "REJ")}
              className="px-3 py-1 text-white bg-red-600 rounded text-sm"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}