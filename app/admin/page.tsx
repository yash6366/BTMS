"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  Search,
  RefreshCw,
  Edit,
  X,
  History,
  Settings,
  ArrowRight,
  ShieldAlert,
  Sliders,
  ChevronRight,
  Car,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  FileText,
  Activity,
} from "lucide-react"
import { AdminStats, AdminEmployeeItem, AccessRequestItem, DBUser } from "@/lib/auth"
import { EditUserModal } from "@/components/admin/EditUserModal"
import { RequisitionOverrideModal } from "@/components/admin/RequisitionOverrideModal"
import { ProvisionUserModal } from "@/components/admin/ProvisionUserModal"
import { SystemHealthCard } from "@/components/admin/SystemHealthCard"
import type { AdminRequisitionItem, TransportKPIs } from "@/lib/admin-transport-service"
import { useAuth } from "@/hooks/use-auth"

interface AuditLogItem {
  id: number
  action: string
  target_id: string
  actor: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { user: currentAuthUser } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")

  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [employees, setEmployees] = useState<AdminEmployeeItem[]>([])
  const [users, setUsers] = useState<DBUser[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])

  // Requisitions & Fleet States (Phase E)
  const [requisitions, setRequisitions] = useState<AdminRequisitionItem[]>([])
  const [reqKpis, setReqKpis] = useState<TransportKPIs | null>(null)
  const [reqStatusFilter, setReqStatusFilter] = useState("ALL")
  const [reqSearch, setReqSearch] = useState("")
  const [reqDeptFilter, setReqDeptFilter] = useState("ALL")
  const [reqPage, setReqPage] = useState(1)
  const [reqPageSize, setReqPageSize] = useState(25)
  const [reqPagination, setReqPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [selectedRequisition, setSelectedRequisition] = useState<AdminRequisitionItem | null>(null)

  // Search, Filter & Server-side Pagination States (Phase D)
  const [empSearch, setEmpSearch] = useState("")
  const [empDeptFilter, setEmpDeptFilter] = useState("ALL")
  const [empPage, setEmpPage] = useState(1)
  const [empPageSize, setEmpPageSize] = useState(25)
  const [empPagination, setEmpPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 })
  const [showProvisionModal, setShowProvisionModal] = useState(false)
  const [selectedProvisionEmp, setSelectedProvisionEmp] = useState<AdminEmployeeItem | null>(null)

  // User Accounts & Access Elevation Filtering (Phase B & C)
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("ALL")
  const [requestStatusFilter, setRequestStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL")

  // Modal Dialog States
  const [showAddEmpModal, setShowAddEmpModal] = useState(false)
  const [showEditEmpModal, setShowEditEmpModal] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState<AdminEmployeeItem | null>(null)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<DBUser | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AccessRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  // Add Employee Form State
  const [newEmp, setNewEmp] = useState({
    empId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    designation: "",
    email: "",
    department: "Information Technology",
  })

  // Edit Employee Form State
  const [editEmp, setEditEmp] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    designation: "",
    email: "",
    department: "",
  })

  // Clear toast notifications after 4s
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(""), 4000)
      return () => clearTimeout(t)
    }
  }, [successMessage])

  // Centralized Authenticated Admin Fetcher
  // 401 -> Session expired -> redirect to login
  // 403 -> Forbidden -> unauthorized notice and redirect to dashboard
  const adminFetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options)
      if (res.status === 401) {
        router.push("/login?redirect=/admin")
        throw new Error("SESSION_EXPIRED")
      }
      if (res.status === 403) {
        setError("Access denied. Administrator privileges required.")
        router.push("/dashboard")
        throw new Error("FORBIDDEN")
      }
      return res
    } catch (err) {
      if (err instanceof Error && (err.message === "SESSION_EXPIRED" || err.message === "FORBIDDEN")) {
        throw err
      }
      console.error(`adminFetch error on ${url}:`, err)
      throw err
    }
  }, [router])

  // Fetch Dashboard Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (err) {
      console.error("fetchStats error:", err)
    }
  }, [adminFetch])

  // Fetch Employees List with Server-Side Pagination
  const fetchEmployees = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (empSearch) params.set("search", empSearch)
      if (empDeptFilter !== "ALL") params.set("department", empDeptFilter)
      params.set("page", empPage.toString())
      params.set("pageSize", empPageSize.toString())
      const res = await adminFetch(`/api/admin/employees?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.employees || [])
        if (data.pagination) {
          setEmpPagination(data.pagination)
        }
      }
    } catch (err) {
      console.error("fetchEmployees error:", err)
    }
  }, [adminFetch, empSearch, empDeptFilter, empPage, empPageSize])

  // Fetch Users List
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (userSearch) params.set("search", userSearch)
      if (userRoleFilter !== "ALL") params.set("role", userRoleFilter)
      const res = await adminFetch(`/api/admin/users?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error("fetchUsers error:", err)
    }
  }, [adminFetch, userSearch, userRoleFilter])

  // Fetch Access Requests with status filter (Phase C)
  const fetchAccessRequests = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/access-requests?status=${requestStatusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setAccessRequests(data.requests || [])
      }
    } catch (err) {
      console.error("fetchAccessRequests error:", err)
    }
  }, [adminFetch, requestStatusFilter])

  // Fetch Requisitions and Transport KPIs (Phase E)
  const fetchRequisitions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (reqStatusFilter !== "ALL") params.set("status", reqStatusFilter)
      if (reqSearch) params.set("search", reqSearch)
      if (reqDeptFilter !== "ALL") params.set("department", reqDeptFilter)
      params.set("page", reqPage.toString())
      params.set("pageSize", reqPageSize.toString())
      const res = await adminFetch(`/api/admin/requisitions?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRequisitions(data.requisitions || [])
        if (data.pagination) setReqPagination(data.pagination)
        if (data.kpis) setReqKpis(data.kpis)
      }
    } catch (err) {
      console.error("fetchRequisitions error:", err)
    }
  }, [adminFetch, reqStatusFilter, reqSearch, reqDeptFilter, reqPage, reqPageSize])

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/audit?limit=100")
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.logs || [])
      }
    } catch (err) {
      console.error("fetchAuditLogs error:", err)
    }
  }, [adminFetch])

  // Refresh All Data
  const refreshAll = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([
      fetchStats(),
      fetchEmployees(),
      fetchUsers(),
      fetchAccessRequests(),
      fetchAuditLogs(),
      fetchRequisitions(),
    ])
    setIsLoading(false)
  }, [fetchStats, fetchEmployees, fetchUsers, fetchAccessRequests, fetchAuditLogs, fetchRequisitions])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Handle Adding Employee
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmp),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMessage(`Employee ${newEmp.empId} added successfully to Master Directory.`)
        setShowAddEmpModal(false)
        setNewEmp({
          empId: "",
          firstName: "",
          middleName: "",
          lastName: "",
          designation: "",
          email: "",
          department: "Information Technology",
        })
        fetchEmployees()
        fetchStats()
      } else {
        setError(data.error || "Failed to add employee.")
      }
    } catch {
      setError("Network error while creating employee record.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Editing Employee
  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp) return
    setActionLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/admin/employees/${selectedEmp.empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editEmp),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMessage(`Employee ${selectedEmp.empId} updated successfully.`)
        setShowEditEmpModal(false)
        fetchEmployees()
      } else {
        setError(data.error || "Failed to update employee.")
      }
    } catch {
      setError("Network error while updating employee.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Soft Retirement / Activation of Employee
  const handleToggleEmployeeStatus = async (emp: AdminEmployeeItem) => {
    const nextStatus = emp.active === "1" ? "0" : "1"
    const confirmMsg =
      nextStatus === "0"
        ? `Are you sure you want to deactivate/retire employee ${emp.empId}? This will also disable their portal login.`
        : `Reactivate employee ${emp.empId}?`

    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch(`/api/admin/employees/${emp.empId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextStatus }),
      })

      if (res.ok) {
        setSuccessMessage(`Employee ${emp.empId} status updated.`)
        fetchEmployees()
        fetchUsers()
        fetchStats()
      }
    } catch {
      alert("Failed to update employee status.")
    }
  }

  // Handle User Account Status Toggle
  const handleToggleUserStatus = async (user: DBUser) => {
    const nextStatus = user.active === "1" ? "0" : "1"
    try {
      const res = await fetch(`/api/admin/users/${user.username}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextStatus }),
      })

      if (res.ok) {
        setSuccessMessage(`User ${user.username} is now ${nextStatus === "1" ? "ACTIVE" : "DEACTIVATED"}.`)
        fetchUsers()
        fetchStats()
      }
    } catch {
      alert("Failed to toggle user status.")
    }
  }

  // Handle Access Request Action (Approve / Reject)
  const handleProcessRequest = async (action: "approve" | "reject") => {
    if (!selectedRequest) return
    setActionLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action,
          reason: rejectReason || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMessage(data.message || `Request ${action}d successfully.`)
        setShowReviewModal(false)
        setSelectedRequest(null)
        setRejectReason("")
        fetchAccessRequests()
        fetchUsers()
        fetchStats()
        fetchAuditLogs()
      } else {
        setError(data.error || `Failed to ${action} request.`)
      }
    } catch {
      setError("Network error while processing request.")
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch {
      router.push("/login")
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shadow-lg shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950">
          <div className="h-9 w-14 bg-white rounded flex items-center justify-center p-1">
            <Image src="/logo.png" alt="BHEL Logo" width={52} height={32} className="h-7 w-auto object-contain" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">BHEL BTMS</h2>
            <span className="text-[10px] text-blue-400 font-semibold tracking-wider uppercase block">
              Administration Center
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "overview" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Sliders className="h-4 w-4" />
              <span>Overview</span>
            </div>
          </button>

          <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Operations & Fleet
          </div>

          <button
            onClick={() => setActiveTab("requisitions")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "requisitions" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Car className="h-4 w-4" />
              <span>Requisitions & Fleet</span>
            </div>
            {reqKpis && reqKpis.pendingApprovals > 0 ? (
              <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                {reqKpis.pendingApprovals}
              </span>
            ) : null}
          </button>

          <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Personnel & Access
          </div>

          <button
            onClick={() => setActiveTab("employees")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "employees" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Users className="h-4 w-4" />
              <span>Employee Master</span>
            </div>
            {stats && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">{stats.totalEmployees}</span>}
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "requests" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <KeyRound className="h-4 w-4" />
              <span>Role Requests</span>
            </div>
            {accessRequests.length > 0 && (
              <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full animate-pulse">
                {accessRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "users" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className="h-4 w-4" />
              <span>User Accounts (RBAC)</span>
            </div>
            {stats && <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">{stats.registeredAccounts}</span>}
          </button>

          <div className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Governance & Audit
          </div>

          <button
            onClick={() => setActiveTab("audit")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "audit" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <History className="h-4 w-4" />
              <span>Audit & Security Logs</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "settings" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Settings className="h-4 w-4" />
              <span>System & Policies</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
          <div className="flex items-center space-x-2 px-2 py-1 bg-slate-900 rounded border border-slate-800">
            <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              A
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-white block truncate">Administrator</span>
              <span className="text-[10px] text-green-400 block font-mono">ROLE: SYSTEM ADMIN</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <Button variant="ghost" size="sm" asChild className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 h-7 px-2">
              <Link href="/dashboard">
                <ArrowRight className="h-3 w-3 mr-1" /> Portal
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 h-7 px-2"
            >
              <LogOut className="h-3 w-3 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Operational Bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-xs z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-bold text-gray-900 capitalize">
              {activeTab === "overview" && "System Administration Overview"}
              {activeTab === "employees" && "Authoritative Employee Master Directory"}
              {activeTab === "requests" && "Role Elevation & Access Review Queue"}
              {activeTab === "users" && "User Accounts & Role-Based Access Control"}
              {activeTab === "audit" && "Append-Only Security Audit Trail"}
              {activeTab === "settings" && "System Architecture & Organization Parameters"}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={isLoading}
              className="h-8 text-xs text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            {activeTab === "employees" && (
              <Button
                size="sm"
                onClick={() => setShowAddEmpModal(true)}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Add Employee
              </Button>
            )}
          </div>
        </header>

        {/* Dynamic Alerts Banner */}
        {successMessage && (
          <div className="bg-green-50 border-b border-green-200 px-6 py-2.5 flex items-center justify-between text-xs text-green-900 font-medium">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage("")} className="text-green-700 hover:text-green-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs text-red-900 font-medium">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-red-700 hover:text-red-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Work Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ======================================================== */}
          {/* TAB 1: OVERVIEW & DASHBOARD METRICS                      */}
          {/* ======================================================== */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* 5 KPI Metric Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="border-gray-200 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Master Directory</span>
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">{stats?.totalEmployees ?? "..."}</span>
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">Authoritative</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Registered Accounts</span>
                      <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">{stats?.registeredAccounts ?? "..."}</span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">Portal Users</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Active Accounts</span>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">{stats?.activeAccounts ?? "..."}</span>
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">Ready</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-xs">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Pending Review</span>
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-amber-900">{stats?.pendingRegistrations ?? "..."}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Inactive</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-xs bg-amber-50/40 border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-900">Role Requests</span>
                      <KeyRound className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-amber-900">{stats?.pendingRoleRequests ?? accessRequests.length}</span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 font-bold px-1.5 py-0.5 rounded">Action Required</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transport & Requisition Operational Pulse (Phase E) */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-sm border border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-700/60">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                      <Car className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide">Fleet & Ride Requisition Pulse</h3>
                      <p className="text-[11px] text-slate-300">Live system-wide movement across indenting, authorization, and dispatch</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("requisitions")}
                    className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold self-start sm:self-auto"
                  >
                    Open Fleet Control <ChevronRightIcon className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
                    <span className="text-[11px] text-slate-400 block font-medium">Pending Manager Approvals</span>
                    <span className="text-xl font-bold text-amber-400 block mt-1">{reqKpis?.pendingApprovals ?? "..."}</span>
                  </div>
                  <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
                    <span className="text-[11px] text-slate-400 block font-medium">Approved - Pending Fleet</span>
                    <span className="text-xl font-bold text-blue-400 block mt-1">{reqKpis?.pendingAllotment ?? "..."}</span>
                  </div>
                  <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
                    <span className="text-[11px] text-slate-400 block font-medium">Allotted & Dispatched</span>
                    <span className="text-xl font-bold text-emerald-400 block mt-1">{reqKpis?.allottedTrips ?? "..."}</span>
                  </div>
                  <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
                    <span className="text-[11px] text-slate-400 block font-medium">Today's Scheduled Trips</span>
                    <span className="text-xl font-bold text-white block mt-1">{reqKpis?.todayTrips ?? "..."}</span>
                  </div>
                </div>
              </div>

              {/* Action Cards & Role Request Spotlight */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending Role Approvals Spotlight */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-gray-200 shadow-xs">
                    <CardHeader className="py-3.5 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-gray-900">Pending Role Elevation Requests</CardTitle>
                        <CardDescription className="text-xs text-gray-500">Staff requests for Manager or Transport access requiring admin review.</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab("requests")} className="text-xs text-blue-600 hover:text-blue-700 h-7">
                        View All <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {accessRequests.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-500">
                          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-80" />
                          No pending access elevation requests in queue.
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {accessRequests.slice(0, 3).map((req) => (
                            <div key={req.id} className="p-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-xs text-gray-900">{req.employeeName}</span>
                                  <span className="text-[11px] font-mono text-gray-500">({req.username})</span>
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 border-amber-200">
                                    Request: {req.requestedRole}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {req.department} · {req.designation} · {new Date(req.requestedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setShowReviewModal(true)
                                }}
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
                              >
                                Review Request
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Governance Links */}
                <div className="space-y-4">
                  <Card className="border-gray-200 shadow-xs">
                    <CardHeader className="py-3 px-4 border-b border-gray-100">
                      <CardTitle className="text-sm font-bold text-gray-900">Administrative Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setActiveTab("employees")
                          setShowAddEmpModal(true)
                        }}
                        className="w-full justify-start text-xs h-9 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <UserPlus className="h-4 w-4 mr-2 text-blue-600" />
                        Onboard New Employee
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("users")}
                        className="w-full justify-start text-xs h-9 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <ShieldCheck className="h-4 w-4 mr-2 text-indigo-600" />
                        Manage User Permissions (RBAC)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("audit")}
                        className="w-full justify-start text-xs h-9 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <History className="h-4 w-4 mr-2 text-slate-600" />
                        Inspect Security Audit Trail
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Architecture & RBAC Invariant Card */}
                  <Card className="border-blue-200 bg-blue-50/50 shadow-xs">
                    <CardContent className="p-3.5 text-xs text-blue-900 space-y-1.5">
                      <div className="font-bold flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-1.5 text-blue-700" />
                        Certified RBAC Invariant
                      </div>
                      <p className="text-[11px] leading-relaxed text-blue-800">
                        Self-registration strictly assigns standard <code>Employee</code> permissions. Manager and Transport authorities are only granted through administrator approval recorded with append-only audit logging.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: TRANSPORT REQUISITIONS & FLEET OVERSIGHT (PHASE E) */}
          {/* ======================================================== */}
          {activeTab === "requisitions" && (
            <div className="space-y-4 max-w-7xl mx-auto">
              {/* Filter Controls & Status Pills */}
              <div className="bg-white p-3.5 rounded-lg border border-gray-200 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-gray-100">
                  <Button
                    variant={reqStatusFilter === "ALL" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReqStatusFilter("ALL"); setReqPage(1); }}
                    className="text-xs h-8"
                  >
                    All Requisitions ({reqPagination.total})
                  </Button>
                  <Button
                    variant={reqStatusFilter === "PENDING_APPROVAL" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReqStatusFilter("PENDING_APPROVAL"); setReqPage(1); }}
                    className={`text-xs h-8 ${reqStatusFilter === "PENDING_APPROVAL" ? "bg-amber-600 hover:bg-amber-700" : "text-amber-800 border-amber-300 hover:bg-amber-50"}`}
                  >
                    Pending Approval ({reqKpis?.pendingApprovals ?? 0})
                  </Button>
                  <Button
                    variant={reqStatusFilter === "PENDING_ALLOTMENT" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReqStatusFilter("PENDING_ALLOTMENT"); setReqPage(1); }}
                    className={`text-xs h-8 ${reqStatusFilter === "PENDING_ALLOTMENT" ? "bg-blue-600 hover:bg-blue-700" : "text-blue-800 border-blue-300 hover:bg-blue-50"}`}
                  >
                    Pending Allotment ({reqKpis?.pendingAllotment ?? 0})
                  </Button>
                  <Button
                    variant={reqStatusFilter === "ALLOTTED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReqStatusFilter("ALLOTTED"); setReqPage(1); }}
                    className={`text-xs h-8 ${reqStatusFilter === "ALLOTTED" ? "bg-emerald-600 hover:bg-emerald-700" : "text-emerald-800 border-emerald-300 hover:bg-emerald-50"}`}
                  >
                    Fleet Allotted ({reqKpis?.allottedTrips ?? 0})
                  </Button>
                  <Button
                    variant={reqStatusFilter === "REJECTED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setReqStatusFilter("REJECTED"); setReqPage(1); }}
                    className="text-xs h-8 text-red-700 border-red-200 hover:bg-red-50"
                  >
                    Rejected / Denied
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="flex flex-1 items-center space-x-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                      <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                      <Input
                        placeholder="Search Serial, Passenger, Staff No..."
                        value={reqSearch}
                        onChange={(e) => { setReqSearch(e.target.value); setReqPage(1); }}
                        className="pl-9 text-xs h-9"
                      />
                    </div>

                    <Select value={reqDeptFilter} onValueChange={(val) => { setReqDeptFilter(val); setReqPage(1); }}>
                      <SelectTrigger className="w-48 text-xs h-9">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Departments</SelectItem>
                        <SelectItem value="Information Technology">Information Technology</SelectItem>
                        <SelectItem value="Transport & Logistics">Transport & Logistics</SelectItem>
                        <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-xs text-gray-500 font-medium">
                    Showing page {reqPage} of {reqPagination.totalPages || 1} ({reqPagination.total} total)
                  </div>
                </div>
              </div>

              {/* Requisitions Table */}
              <Card className="border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Serial / ID</th>
                        <th className="py-3 px-4">Passenger</th>
                        <th className="py-3 px-4">Route</th>
                        <th className="py-3 px-4">Schedule</th>
                        <th className="py-3 px-4">Vehicle / Purpose</th>
                        <th className="py-3 px-4">Approval State</th>
                        <th className="py-3 px-4">Fleet Assignment</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {requisitions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-gray-500">
                            No ride requisitions match the selected status or filters.
                          </td>
                        </tr>
                      ) : (
                        requisitions.map((req) => (
                          <tr key={req.serialNo} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-900">{req.serialNo}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-gray-900 block">{req.passengerName}</span>
                              <span className="font-mono text-[11px] text-gray-500 block">
                                ID: {req.staffNo} | {req.department}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-gray-900 font-medium block">{req.startingPlace}</span>
                              <span className="text-[11px] text-gray-500 block">&rarr; {req.destination}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-800 block">
                                {req.tripDate ? new Date(req.tripDate).toLocaleDateString() : "—"}
                              </span>
                              <span className="text-[11px] text-gray-500 font-mono block">{req.tripTime}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-800 block">{req.vehicleRequested}</span>
                              <span className="text-[11px] text-gray-500 block truncate max-w-[140px]">{req.purpose}</span>
                            </td>
                            <td className="py-3 px-4">
                              {req.statusApprover === "APVD" ? (
                                <Badge className="bg-green-50 text-green-800 border-green-200 text-[10px] font-bold">
                                  ✓ Approved
                                </Badge>
                              ) : req.statusApprover === "REJ" ? (
                                <Badge className="bg-red-50 text-red-800 border-red-200 text-[10px] font-bold">
                                  ✕ Rejected
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-900 border-amber-300 text-[10px] font-bold">
                                  ⏳ Pending Approver
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {req.statusTransport === "PASS" ? (
                                <div>
                                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px] font-bold">
                                    Allotted: {req.vehicleNo || req.vehicleAllotted || "Vehicle"}
                                  </Badge>
                                  {req.driverName && (
                                    <span className="text-[10px] text-gray-500 block mt-0.5 font-sans">
                                      Driver: {req.driverName} {req.driverMobile ? `(${req.driverMobile})` : ""}
                                    </span>
                                  )}
                                </div>
                              ) : req.statusApprover === "APVD" ? (
                                <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
                                  Awaiting Dispatch
                                </Badge>
                              ) : (
                                <span className="text-gray-400 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {req.statusApprover === "OPEN" ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequisition(req)
                                    setShowOverrideModal(true)
                                  }}
                                  className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                                  Override
                                </Button>
                              ) : (
                                <span className="text-[11px] text-gray-400">Processed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                  <div className="text-xs text-gray-500">
                    Showing {Math.min((reqPage - 1) * reqPageSize + 1, reqPagination.total)} to{" "}
                    {Math.min(reqPage * reqPageSize, reqPagination.total)} of {reqPagination.total} requisitions
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={reqPageSize.toString()}
                      onValueChange={(val) => {
                        setReqPageSize(parseInt(val, 10))
                        setReqPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 text-xs h-8">
                        <SelectValue placeholder="25" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / page</SelectItem>
                        <SelectItem value="25">25 / page</SelectItem>
                        <SelectItem value="50">50 / page</SelectItem>
                        <SelectItem value="100">100 / page</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reqPage <= 1}
                      onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                    </Button>
                    <span className="text-xs font-semibold px-1 text-gray-700">
                      Page {reqPage} of {reqPagination.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={reqPage >= (reqPagination.totalPages || 1)}
                      onClick={() => setReqPage((p) => p + 1)}
                      className="h-8 px-2 text-xs"
                    >
                      Next <ChevronRightIcon className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: EMPLOYEE MASTER DIRECTORY                         */}
          {/* ======================================================== */}
          {activeTab === "employees" && (
            <div className="space-y-4 max-w-7xl mx-auto">
              {/* Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-lg border border-gray-200">
                <div className="flex flex-1 items-center space-x-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <Input
                      placeholder="Search Staff ID, Name, Email..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                      className="pl-9 text-xs h-9"
                    />
                  </div>

                  <Select value={empDeptFilter} onValueChange={(val) => setEmpDeptFilter(val)}>
                    <SelectTrigger className="w-48 text-xs h-9">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      <SelectItem value="Information Technology">Information Technology</SelectItem>
                      <SelectItem value="Transport & Logistics">Transport & Logistics</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Human Resources">Human Resources</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-gray-500 font-medium">
                  Showing {employees.length} master employee records
                </div>
              </div>

              {/* Master Directory Table */}
              <Card className="border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Staff ID</th>
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Department & Designation</th>
                        <th className="py-3 px-4">Official Email</th>
                        <th className="py-3 px-4">Master Status</th>
                        <th className="py-3 px-4">Portal Account</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {employees.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            No employee master records match the filter criteria.
                          </td>
                        </tr>
                      ) : (
                        employees.map((emp) => (
                          <tr key={emp.empId} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-900">{emp.empId}</td>
                            <td className="py-3 px-4 font-semibold text-gray-900">{emp.fullName}</td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-800 block">{emp.department}</span>
                              <span className="text-[11px] text-gray-500 block">{emp.designation}</span>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{emp.email}</td>
                            <td className="py-3 px-4">
                              {emp.active === "1" ? (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-800 border-green-200">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-600 border-gray-200">
                                  Retired / Inactive
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {emp.hasAccount ? (
                                <span className={`inline-flex items-center text-[11px] font-medium ${emp.accountActive ? "text-green-700" : "text-amber-700"}`}>
                                  {emp.accountActive ? `✓ Active (${emp.usergroup || "User"})` : "⏳ Pending Authorization"}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">Not Registered</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              {!emp.hasAccount && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedProvisionEmp(emp)
                                    setShowProvisionModal(true)
                                  }}
                                  className="h-7 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                                >
                                  <UserPlus className="h-3 w-3 mr-1" /> Provision
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmp(emp)
                                  setEditEmp({
                                    firstName: emp.firstName,
                                    middleName: emp.middleName || "",
                                    lastName: emp.lastName,
                                    designation: emp.designation,
                                    email: emp.email,
                                    department: emp.department,
                                  })
                                  setShowEditEmpModal(true)
                                }}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleEmployeeStatus(emp)}
                                className={`h-7 px-2 text-[11px] ${
                                  emp.active === "1"
                                    ? "text-amber-700 hover:bg-amber-50"
                                    : "text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {emp.active === "1" ? "Deactivate" : "Activate"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Server-Side Pagination Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                  <div className="text-xs text-gray-500">
                    Showing {Math.min((empPage - 1) * empPageSize + 1, empPagination.total)} to{" "}
                    {Math.min(empPage * empPageSize, empPagination.total)} of {empPagination.total} master records
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={empPageSize.toString()}
                      onValueChange={(val) => {
                        setEmpPageSize(parseInt(val, 10))
                        setEmpPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 text-xs h-8">
                        <SelectValue placeholder="25" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / page</SelectItem>
                        <SelectItem value="25">25 / page</SelectItem>
                        <SelectItem value="50">50 / page</SelectItem>
                        <SelectItem value="100">100 / page</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={empPage <= 1}
                      onClick={() => setEmpPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                    </Button>
                    <span className="text-xs font-semibold px-1 text-gray-700">
                      Page {empPage} of {empPagination.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={empPage >= (empPagination.totalPages || 1)}
                      onClick={() => setEmpPage((p) => p + 1)}
                      className="h-8 px-2 text-xs"
                    >
                      Next <ChevronRightIcon className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ACCESS & ROLE REQUESTS QUEUE                      */}
          {/* ======================================================== */}
          {activeTab === "requests" && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <Card className="border-gray-200 shadow-xs">
                <CardHeader className="py-3.5 px-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-gray-900">Access Elevation Review Queue</CardTitle>
                      <CardDescription className="text-xs text-gray-500">
                        Review pending onboarding access requests for Manager / Transport privileges.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-900 border-amber-300">
                      {accessRequests.length} Showing ({requestStatusFilter})
                    </Badge>
                  </div>
                </CardHeader>

                {/* Status Filter Tabs (Phase C) */}
                <div className="flex items-center space-x-2 px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
                  <Button
                    variant={requestStatusFilter === "ALL" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequestStatusFilter("ALL")}
                    className="text-xs h-7 px-2.5"
                  >
                    All Requests
                  </Button>
                  <Button
                    variant={requestStatusFilter === "PENDING" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequestStatusFilter("PENDING")}
                    className={`text-xs h-7 px-2.5 ${requestStatusFilter === "PENDING" ? "bg-amber-600 hover:bg-amber-700" : "text-amber-800 border-amber-300"}`}
                  >
                    Pending
                  </Button>
                  <Button
                    variant={requestStatusFilter === "APPROVED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequestStatusFilter("APPROVED")}
                    className={`text-xs h-7 px-2.5 ${requestStatusFilter === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "text-emerald-800 border-emerald-300"}`}
                  >
                    Approved
                  </Button>
                  <Button
                    variant={requestStatusFilter === "REJECTED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRequestStatusFilter("REJECTED")}
                    className="text-xs h-7 px-2.5 text-red-700 border-red-200"
                  >
                    Rejected
                  </Button>
                </div>

                <CardContent className="p-0">
                  {accessRequests.length === 0 ? (
                    <div className="p-12 text-center text-xs text-gray-500">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3 opacity-90" />
                      <p className="font-semibold text-gray-700 text-sm">Review Queue Empty</p>
                      <p className="mt-1">No requests currently match the selected status filter.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {accessRequests.map((req) => (
                        <div key={req.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-gray-900">{req.employeeName}</span>
                              <span className="font-mono text-xs text-gray-500 font-semibold">({req.username})</span>
                              <Badge className="bg-blue-100 text-blue-900 border-blue-200 text-xs capitalize font-bold">
                                Requested: {req.requestedRole} Access
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                              <span><strong>Department:</strong> {req.department}</span>
                              <span><strong>Designation:</strong> {req.designation}</span>
                              <span><strong>Official Email:</strong> {req.email}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 italic mt-1">
                              Submitted on {new Date(req.requestedAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {req.status === "PENDING" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setShowReviewModal(true)
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 font-semibold"
                              >
                                Review & Decision
                              </Button>
                            ) : req.status === "APPROVED" ? (
                              <div className="text-right">
                                <Badge className="bg-green-100 text-green-900 border-green-200 text-xs font-bold">
                                  ✓ Approved
                                </Badge>
                                {req.reviewedBy && (
                                  <span className="text-[10px] text-gray-500 block mt-0.5 font-sans">
                                    By {req.reviewedBy} {req.reviewedAt ? `on ${new Date(req.reviewedAt).toLocaleDateString()}` : ""}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <Badge className="bg-red-100 text-red-900 border-red-200 text-xs font-bold">
                                  ✕ Rejected
                                </Badge>
                                {req.reviewNotes && (
                                  <span className="text-[10px] text-gray-500 block mt-0.5 max-w-[180px] truncate">
                                    {req.reviewNotes}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: USER ACCOUNTS & RBAC MANAGEMENT                   */}
          {/* ======================================================== */}
          {activeTab === "users" && (
            <div className="space-y-4 max-w-7xl mx-auto">
              {/* Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-lg border border-gray-200">
                <div className="flex flex-1 items-center space-x-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <Input
                      placeholder="Search Username, Email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 text-xs h-9"
                    />
                  </div>

                  <Select value={userRoleFilter} onValueChange={(val) => setUserRoleFilter(val)}>
                    <SelectTrigger className="w-48 text-xs h-9">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Roles</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Transport">Transport</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-gray-500 font-medium">
                  {users.length} registered portal user accounts
                </div>
              </div>

              {/* Users Table */}
              <Card className="border-gray-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Staff ID (Username)</th>
                        <th className="py-3 px-4">Role & Usergroup</th>
                        <th className="py-3 px-4">Permissions (manage / build / tools)</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Reporting Manager</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4 text-right">Access Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            No user accounts match the search criteria.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr key={u.username} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-gray-900">{u.username}</td>
                            <td className="py-3 px-4">
                              <Badge
                                className={`text-[10px] font-bold uppercase ${
                                  u.usergroup === "Admin"
                                    ? "bg-purple-100 text-purple-900 border-purple-200"
                                    : u.usergroup === "Manager"
                                    ? "bg-blue-100 text-blue-900 border-blue-200"
                                    : u.usergroup === "Transport"
                                    ? "bg-orange-100 text-orange-900 border-orange-200"
                                    : "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                              >
                                {u.usergroup || "Employee"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                              manage: {u.manage || "0"} | build: {u.build || "0"} | tools: {u.tools || "0"}
                            </td>
                            <td className="py-3 px-4 text-gray-600">{u.email || "—"}</td>
                            <td className="py-3 px-4 font-mono text-gray-600">{u.reportingto || "—"}</td>
                            <td className="py-3 px-4">
                              {u.active === "1" ? (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-800 border-green-200 font-semibold">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-800 border-red-200 font-semibold">
                                  Disabled
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(u)
                                  setShowEditUserModal(true)
                                }}
                                className="h-7 px-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Manage
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`h-7 px-2.5 text-xs font-semibold ${
                                  u.active === "1"
                                    ? "border-red-200 text-red-700 hover:bg-red-50"
                                    : "border-green-200 text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {u.active === "1" ? "Deactivate" : "Activate"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: AUDIT & SECURITY LOGS                             */}
          {/* ======================================================== */}
          {activeTab === "audit" && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <Card className="border-gray-200 shadow-xs">
                <CardHeader className="py-3.5 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-bold text-gray-900">Append-Only Security Audit Trail</CardTitle>
                  <CardDescription className="text-xs text-gray-500">
                    Chronological record of user registrations, role approvals, master updates, and administrative events.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Action Event</th>
                          <th className="py-3 px-4">Target ID</th>
                          <th className="py-3 px-4">Actor</th>
                          <th className="py-3 px-4">Structured Details</th>
                          <th className="py-3 px-4">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-mono text-xs text-gray-800">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500 font-sans">
                              No audit logs recorded yet.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="py-3 px-4 text-gray-500 font-sans text-[11px]">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-bold text-blue-900">{log.action}</span>
                              </td>
                              <td className="py-3 px-4 font-bold text-gray-900">{log.target_id || "—"}</td>
                              <td className="py-3 px-4 font-semibold text-gray-700">{log.actor}</td>
                              <td className="py-3 px-4 text-[11px] text-gray-600 max-w-xs truncate">
                                {JSON.stringify(log.details)}
                              </td>
                              <td className="py-3 px-4 text-gray-500 text-[11px]">{log.ip_address}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: SYSTEM & POLICIES                                 */}
          {/* ======================================================== */}
          {activeTab === "settings" && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* System Diagnostics Probe (Phase F) */}
              <SystemHealthCard />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-gray-200 shadow-xs">
                  <CardHeader className="py-3.5 px-4 border-b border-gray-100">
                    <CardTitle className="text-sm font-bold text-gray-900">BHEL Transport Divisions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-semibold text-gray-800">IT</span>
                      <span className="text-gray-600">Information Technology</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-semibold text-gray-800">TRN</span>
                      <span className="text-gray-600">Transport & Logistics</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-semibold text-gray-800">MFG</span>
                      <span className="text-gray-600">Manufacturing & Production</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-semibold text-gray-800">FIN</span>
                      <span className="text-gray-600">Finance & Accounts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">HR</span>
                      <span className="text-gray-600">Human Resources</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-xs">
                  <CardHeader className="py-3.5 px-4 border-b border-gray-100">
                    <CardTitle className="text-sm font-bold text-gray-900">Transport Operating Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs text-gray-700">
                    <p>• <strong>Operating Hours:</strong> 07:00 to 19:00 (Standard shifts)</p>
                    <p>• <strong>Emergency / After-Hours:</strong> Requires designated manager approval</p>
                    <p>• <strong>Advance Notice:</strong> 30 minutes minimum for station/airport transfers</p>
                    <p>• <strong>Role Hierarchy:</strong> Approvers review requisitions; Transport officers assign vehicles and drivers</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ADD EMPLOYEE TO MASTER DIRECTORY                  */}
      {/* ======================================================== */}
      <Dialog open={showAddEmpModal} onOpenChange={setShowAddEmpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Onboard Employee to Master Directory</DialogTitle>
            <DialogDescription className="text-xs">
              Add new employee to BHEL Master Directory to enable self-registration verification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddEmployeeSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Staff Number (User ID) *</Label>
              <Input
                placeholder="e.g. 6299005"
                value={newEmp.empId}
                onChange={(e) => setNewEmp({ ...newEmp, empId: e.target.value })}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">First Name *</Label>
                <Input
                  placeholder="First name"
                  value={newEmp.firstName}
                  onChange={(e) => setNewEmp({ ...newEmp, firstName: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Last Name *</Label>
                <Input
                  placeholder="Last name"
                  value={newEmp.lastName}
                  onChange={(e) => setNewEmp({ ...newEmp, lastName: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Official BHEL Email *</Label>
              <Input
                type="email"
                placeholder="name@bhel.in"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Department *</Label>
                <Select value={newEmp.department} onValueChange={(val) => setNewEmp({ ...newEmp, department: val })}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Information Technology">Information Technology</SelectItem>
                    <SelectItem value="Transport & Logistics">Transport & Logistics</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Human Resources">Human Resources</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Designation *</Label>
                <Input
                  placeholder="e.g. Engineer"
                  value={newEmp.designation}
                  onChange={(e) => setNewEmp({ ...newEmp, designation: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddEmpModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save to Directory"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL: EDIT EMPLOYEE MASTER RECORD                       */}
      {/* ======================================================== */}
      <Dialog open={showEditEmpModal} onOpenChange={setShowEditEmpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Employee Master Record ({selectedEmp?.empId})</DialogTitle>
            <DialogDescription className="text-xs">
              Update employee master directory attributes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditEmployeeSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">First Name *</Label>
                <Input
                  value={editEmp.firstName}
                  onChange={(e) => setEditEmp({ ...editEmp, firstName: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Last Name *</Label>
                <Input
                  value={editEmp.lastName}
                  onChange={(e) => setEditEmp({ ...editEmp, lastName: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Official Email *</Label>
              <Input
                type="email"
                value={editEmp.email}
                onChange={(e) => setEditEmp({ ...editEmp, email: e.target.value })}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Department *</Label>
                <Select value={editEmp.department} onValueChange={(val) => setEditEmp({ ...editEmp, department: val })}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Information Technology">Information Technology</SelectItem>
                    <SelectItem value="Transport & Logistics">Transport & Logistics</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Human Resources">Human Resources</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Designation *</Label>
                <Input
                  value={editEmp.designation}
                  onChange={(e) => setEditEmp({ ...editEmp, designation: e.target.value })}
                  required
                  className="text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowEditEmpModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL: REVIEW & ACTION ROLE ELEVATION REQUEST            */}
      {/* ======================================================== */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Review Role Access Request</DialogTitle>
            <DialogDescription className="text-xs">
              Review candidate credentials before approving elevated operational privileges.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Employee Name:</span>
                  <span className="font-bold text-gray-900">{selectedRequest.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Staff Number:</span>
                  <span className="font-mono font-bold text-gray-900">{selectedRequest.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Department:</span>
                  <span className="font-medium text-gray-800">{selectedRequest.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Designation:</span>
                  <span className="font-medium text-gray-800">{selectedRequest.designation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested Access:</span>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold uppercase">
                    {selectedRequest.requestedRole}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <strong>Authorization Policy:</strong> Approving will atomically grant{" "}
                {selectedRequest.requestedRole.toLowerCase() === "manager" ? (
                  <span><code>manage = 1, build = 1</code> (Ride requisition approval permissions)</span>
                ) : (
                  <span><code>tools = 1</code> (Vehicle dispatch and driver assignment permissions)</span>
                )}{" "}
                and activate the account immediately.
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-gray-700">Rejection Notes (Optional if rejecting)</Label>
                <Input
                  placeholder="e.g. Not authorized for department manager role"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <DialogFooter className="pt-3 gap-2 flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleProcessRequest("reject")}
                  className="text-red-700 border-red-200 hover:bg-red-50 font-semibold"
                >
                  Reject (Set Standard Employee)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleProcessRequest("approve")}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & Grant Privileges"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL: EDIT USER PRIVILEGES, ROLES & CREDENTIALS         */}
      {/* ======================================================== */}
      <EditUserModal
        open={showEditUserModal}
        onOpenChange={setShowEditUserModal}
        user={selectedUser}
        currentAdminUsername={currentAuthUser?.username || "admin"}
        onUserUpdated={() => {
          fetchUsers()
          fetchStats()
          fetchAuditLogs()
        }}
      />

      {/* ======================================================== */}
      {/* MODAL: PROVISION NEW USER ACCOUNT (PHASE D)               */}
      {/* ======================================================== */}
      <ProvisionUserModal
        open={showProvisionModal}
        onOpenChange={setShowProvisionModal}
        employee={selectedProvisionEmp}
        onProvisionSuccess={() => {
          fetchEmployees()
          fetchUsers()
          fetchStats()
          fetchAuditLogs()
        }}
      />

      {/* ======================================================== */}
      {/* MODAL: REQUISITION OVERRIDE / FORCE-APPROVAL (PHASE E)   */}
      {/* ======================================================== */}
      <RequisitionOverrideModal
        open={showOverrideModal}
        onOpenChange={setShowOverrideModal}
        requisition={selectedRequisition}
        onOverrideSuccess={() => {
          fetchRequisitions()
          fetchStats()
          fetchAuditLogs()
        }}
      />
    </div>
  )
}
