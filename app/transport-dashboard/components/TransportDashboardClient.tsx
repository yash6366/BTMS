"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, CheckCircle, User } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth } from "@/hooks/use-auth"
import dynamic from "next/dynamic"

// Lazy load components
const TransportPendingRequests = dynamic(() => import("./TransportPendingRequests"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const TransportPassedRequests = dynamic(() => import("./TransportPassedRequests"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const Profile = dynamic(() => import("@/app/dashboard/components/Profile"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

// Component skeleton for loading states
const ComponentSkeleton = () => (
  <div className="p-8 animate-pulse">
    <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>
)

export default function TransportDashboardClient() {
  const { user, isLoading, logout } = useAuth()
  const [activeMenu, setActiveMenu] = useState("pending")
  const router = useRouter()

  // Transport-specific menu items
  const menuItems = [
    { label: "Pending Requests", value: "pending", icon: ClipboardList },
    { label: "Passed Requests", value: "passed", icon: CheckCircle },
    { label: "Profile", value: "profile", icon: User },
  ]

  // Redirect if not logged in or not a transport user
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "transport")) {
      router.push("/login")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading transport dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "transport") return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        title="BHEL Transport"
        subtitle="Transport Management"
        user={{ 
          name: user.username || "Transport User",
          email: "transport@bhel.in", 
          role: "Transport Officer"
        }}
        menuItems={menuItems}
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={logout}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {activeMenu === "pending" && <TransportPendingRequests />}
          {activeMenu === "passed" && <TransportPassedRequests />}
          {activeMenu === "profile" && <Profile />}
        </div>
      </main>
    </div>
  )
}