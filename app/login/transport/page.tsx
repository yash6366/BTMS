"use client"

import { Truck } from "lucide-react"
import { SharedLoginForm } from "@/components/auth/SharedLoginForm"

export default function TransportLoginPage() {
  const validateTransportPermissions = (data: { user?: { role?: string; usertype?: string } }) => {
    // Transport users should have usertype 'transport' or role 'transport'
    return data.user?.role === "transport" || data.user?.usertype === "transport"
  }

  return (
    <SharedLoginForm
      userType="transport"
      icon={Truck}
      title="Transport Login"
      description="Access BHEL Transport Management Portal"
      redirectPath="/transport-dashboard"
      subtitle="Transport Personnel Portal"
      validatePermissions={validateTransportPermissions}
    />
  )
}