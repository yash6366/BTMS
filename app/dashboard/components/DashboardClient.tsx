"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard, Car, User, ShieldCheck } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth } from "@/hooks/use-auth"
import dynamic from "next/dynamic"

// Lazy load components for better performance
const Overview = dynamic(() => import("./Overview"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const MyRides = dynamic(() => import("./MyRides.server"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const Profile = dynamic(() => import("./Profile"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const ApprovalDashboard = dynamic(() => import("@/app/manager-dashboard/components/ApprovalDashboard"), {
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

export default function DashboardClient() {
  const { user, isLoading, logout, isManager } = useAuth()
  const [activeMenu, setActiveMenu] = useState("overview")
  const [isApprover, setIsApprover] = useState(false)
  const [empProfile, setEmpProfile] = useState<{ fullName?: string; EMP_LNAME?: string; EMP_FNAME?: string; EMP_MNAME?: string }>({})
  const router = useRouter()

  // Dynamically build menu items
  const menuItems = useMemo(() => {
    const baseItems = [
      { label: "Booking History", value: "overview", icon: LayoutDashboard },
      { label: "Book My Ride", value: "rides", icon: Car },
      { label: "Profile", value: "profile", icon: User },
    ]

    // Add approvals menu for both managers and employees with approval rights
    if (isApprover || isManager()) {
      baseItems.push({ label: "Approvals", value: "approvals", icon: ShieldCheck })
    }

    return baseItems
  }, [isApprover, isManager])

  // Redirect if not logged in or transport user trying to access regular dashboard
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    } else if (!isLoading && user?.role === "transport") {
      // Transport users should be redirected to their own dashboard
      router.push("/transport-dashboard")
    }
  }, [isLoading, user, router])

  // Check if user is approver
  useEffect(() => {
    const checkApprover = async () => {
      try {
        const res = await fetch("/api/approvals/check")
        const result = await res.json()
        if (res.ok && result.isApprover) {
          setIsApprover(true)
        }
      } catch (err) {
        console.error("Error checking approver status", err)
      }
    }

    if (user) checkApprover()
  }, [user])

  // Fetch employee profile data for full name
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/profile")
        if (res.ok) {
          const profileData = await res.json()
          setEmpProfile(profileData)
        }
      } catch (err) {
        console.error("Error fetching profile", err)
      }
    }

    if (user) fetchProfile()
  }, [user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        title="BHEL Transports"
        subtitle="Transport Management"
        user={{ 
          name: empProfile.fullName || empProfile.EMP_LNAME || user.email?.split("@")[0] || user.username || "N/A",
          email: user.email || "N/A", 
          role: isManager() ? "Manager" : "Employee"
        }}
        menuItems={menuItems}
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={logout}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {activeMenu === "overview" && <Overview />}
          {activeMenu === "rides" && <MyRides />}
          {activeMenu === "profile" && <Profile />}
          {activeMenu === "approvals" && (isApprover || isManager()) && <ApprovalDashboard />}
        </div>
      </main>
    </div>
  )
}
