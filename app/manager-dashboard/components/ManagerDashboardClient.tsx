"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard, Car, User, ShieldCheck, Users, BarChart3, Settings } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth } from "@/hooks/use-auth"
import dynamic from "next/dynamic"

// Lazy load all manager dashboard components
const Overview = dynamic(() => import("@/app/dashboard/components/Overview"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const MyRides = dynamic(() => import("@/app/dashboard/components/MyRides.server"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const Profile = dynamic(() => import("@/app/dashboard/components/Profile"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

const ApprovalDashboard = dynamic(() => import("./ApprovalDashboard"), {
  loading: () => <ComponentSkeleton />,
  ssr: false,
})

// TeamManagementPanel will be defined as a function below

// ReportsPanel and SettingsPanel will be defined as functions below

// Component skeleton for loading states
const ComponentSkeleton = () => (
  <div className="p-8 animate-pulse">
    <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-lg border">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded w-full mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default function ManagerDashboardClient() {
  const { user, isLoading, logout, isManager } = useAuth()
  const [activeMenu, setActiveMenu] = useState("overview")
  const router = useRouter()

  // Manager-specific menu items
  const menuItems = useMemo(() => [
    { label: "Dashboard Overview", value: "overview", icon: LayoutDashboard },
    { label: "My Rides", value: "rides", icon: Car },
    { label: "Approvals", value: "approvals", icon: ShieldCheck },
    { label: "Team Management", value: "team", icon: Users },
    { label: "Reports", value: "reports", icon: BarChart3 },
    { label: "Profile", value: "profile", icon: User },
    { label: "Settings", value: "settings", icon: Settings },
  ], [])

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [isLoading, user, router])

  // Redirect non-managers to employee dashboard
  useEffect(() => {
    if (!isLoading && user && !isManager()) {
      router.push("/dashboard")
    }
  }, [isLoading, user, isManager, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading manager dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (!isManager()) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Access Restricted</div>
          <p className="text-gray-600 mb-4">Manager privileges required to access this dashboard.</p>
          <button 
            onClick={() => router.push("/dashboard")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Employee Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        title="BHEL Manager Portal"
        subtitle="Manager Dashboard"
        user={{ 
          name: user.fullName || user.username || "Manager",
          email: user.email || "N/A", 
          role: "Manager"
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
          {activeMenu === "approvals" && <ApprovalDashboard />}
          {activeMenu === "team" && <TeamManagementPanel />}
          {activeMenu === "reports" && <ReportsPanel />}
          {activeMenu === "profile" && <Profile />}
          {activeMenu === "settings" && <SettingsPanel />}
        </div>
      </main>
    </div>
  )
}

// Placeholder components for manager-specific features
function TeamManagementPanel() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Team Management</h2>
      <p className="text-gray-600">Team management features will be implemented here.</p>
      <div className="mt-4 p-4 bg-blue-50 rounded border-l-4 border-blue-400">
        <p className="text-sm text-blue-800">
          <strong>Coming Soon:</strong> View team members, assign roles, and manage permissions.
        </p>
      </div>
    </div>
  )
}

function ReportsPanel() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Reports & Analytics</h2>
      <p className="text-gray-600">Comprehensive reports and analytics dashboard.</p>
      <div className="mt-4 p-4 bg-green-50 rounded border-l-4 border-green-400">
        <p className="text-sm text-green-800">
          <strong>Coming Soon:</strong> Usage statistics, cost analysis, and performance metrics.
        </p>
      </div>
    </div>
  )
}

function SettingsPanel() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Manager Settings</h2>
      <p className="text-gray-600">Configure system settings and preferences.</p>
      <div className="mt-4 p-4 bg-purple-50 rounded border-l-4 border-purple-400">
        <p className="text-sm text-purple-800">
          <strong>Coming Soon:</strong> System configuration, approval workflows, and user management.
        </p>
      </div>
    </div>
  )
}