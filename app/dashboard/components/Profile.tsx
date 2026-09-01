"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { User } from "lucide-react"
import { EmpProfile } from "@/types"

export default function Profile() {
  const { user, isLoading } = useAuth()
  const [empData, setEmpData] = useState<EmpProfile | null>(null)

  useEffect(() => {
    const fetchEmpDetails = async () => {
      try {
        const res = await fetch("/api/profile")
        if (!res.ok) return
        const data = await res.json()
        setEmpData(data)
      } catch (err) {
        console.error("Failed to fetch profile data:", err)
      }
    }

    fetchEmpDetails()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-600">
        Loading profile...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-600">
        Failed to load user profile.
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6" data-testid="profile">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h2>
        {empData?.fullName && (
          <p className="text-xl text-gray-600 font-medium">Welcome, {empData.fullName}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
            <User className="mr-2 h-5 w-5 text-blue-600" />
            Employee Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-700">
          <ProfileRow label="Full Name" value={empData?.fullName || "—"} highlight={true} />
          <Separator />
          <ProfileRow label="Employee ID" value={empData?.EMP_ID || user.username} />
          <Separator />
          <ProfileRow label="Designation" value={empData?.EMP_DESIGNATION || "—"} />
          <Separator />
          <ProfileRow label="Email" value={empData?.EMP_EMAIL_ID || user.email || "—"} />
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="font-medium">{label}:</span>
      <span className={highlight ? "font-semibold text-blue-600 text-base" : ""}>{value}</span>
    </div>
  )
}
