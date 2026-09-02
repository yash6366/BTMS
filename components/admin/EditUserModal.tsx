"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Shield,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  UserCheck,
  UserX,
} from "lucide-react"
import type { DBUser } from "@/lib/auth"
import type { UserRole } from "@/types"

interface EligibleManager {
  username: string
  fullName: string
  department?: string
}

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: DBUser | null
  currentAdminUsername: string
  onUserUpdated: () => void
}

export function EditUserModal({
  open,
  onOpenChange,
  user,
  currentAdminUsername,
  onUserUpdated,
}: EditUserModalProps) {
  const [role, setRole] = useState<UserRole>("employee")
  const [build, setBuild] = useState(false)
  const [manage, setManage] = useState(false)
  const [tools, setTools] = useState(false)
  const [reportingTo, setReportingTo] = useState<string>("")
  const [active, setActive] = useState(true)

  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")

  // Temporary password display state
  const [resettingPassword, setResettingPassword] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isSelf = user ? user.username.toLowerCase() === currentAdminUsername.toLowerCase() : false

  // Fetch managers for ReportingTo select
  useEffect(() => {
    if (open) {
      setLoadingManagers(true)
      fetch("/api/admin/managers")
        .then((res) => (res.ok ? res.json() : { managers: [] }))
        .then((data) => setEligibleManagers(data.managers || []))
        .catch((err) => console.error("Failed to load managers:", err))
        .finally(() => setLoadingManagers(false))
    }
  }, [open])

  // Initialize form when user changes
  useEffect(() => {
    if (user) {
      // Derive canonical role from user record
      let initialRole: UserRole = "employee"
      const ug = (user.usergroup || "").toLowerCase()
      const pa = (user.pageaccess || "").toLowerCase()
      if (ug.includes("admin") || pa.includes("admin") || user.username === "admin") {
        initialRole = "admin"
      } else if (ug.includes("manager") || pa.includes("manager") || user.manage === "1") {
        initialRole = "manager"
      } else if (ug.includes("transport") || pa.includes("transport") || user.tools === "1") {
        initialRole = "transport"
      }

      setRole(initialRole)
      setBuild(user.build === "1" || user.build === "Y" || initialRole === "admin")
      setManage(user.manage === "1" || user.manage === "Y" || initialRole === "admin")
      setTools(user.tools === "1" || user.tools === "Y" || initialRole === "admin")
      setReportingTo(user.Reportingto || user.reportingto || "")
      setActive(user.active === "1")
      setError("")
      setSuccessMessage("")
      setTemporaryPassword(null)
    }
  }, [user])

  // When role changes, set baseline permissions
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole)
    if (newRole === "admin") {
      setBuild(true)
      setManage(true)
      setTools(true)
    } else if (newRole === "manager") {
      setBuild(true)
      setManage(true)
      setTools(false)
    } else if (newRole === "transport") {
      setBuild(false)
      setManage(false)
      setTools(true)
    } else {
      setBuild(false)
      setManage(false)
      setTools(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError("")
    setSuccessMessage("")

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          build,
          manage,
          tools,
          reportingTo: reportingTo || null,
          active,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccessMessage("User privileges and account attributes updated successfully.")
        onUserUpdated()
        setTimeout(() => {
          onOpenChange(false)
        }, 1200)
      } else {
        setError(data.error || "Failed to update user account.")
      }
    } catch {
      setError("Network error while submitting user updates.")
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!user) return
    if (!confirm(`Are you sure you want to reset the password for ${user.username}? A temporary password will be generated.`)) {
      return
    }

    setResettingPassword(true)
    setError("")

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}/reset-password`, {
        method: "POST",
      })

      const data = await res.json()
      if (res.ok && data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword)
        setSuccessMessage("Password reset. Copy the temporary password below.")
      } else {
        setError(data.error || "Failed to reset password.")
      }
    } catch {
      setError("Network error while resetting password.")
    } finally {
      setResettingPassword(false)
    }
  }

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center space-x-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Manage User Account ({user.username})</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Authoritative role elevation, granular permission toggles, and access lifecycle controls.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-3 rounded-md">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Identity Info Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Staff ID / Username:</span>
              <span className="font-mono font-bold text-slate-900">{user.username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Email:</span>
              <span className="text-slate-800">{user.email || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Current Usergroup:</span>
              <Badge variant="outline" className="text-[10px] uppercase font-bold">
                {user.usergroup || "Employee"}
              </Badge>
            </div>
          </div>

          {/* Canonical Role Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-800">
              Assigned Role (Authoritative) *
            </Label>
            <Select
              value={role}
              onValueChange={(val) => handleRoleChange(val as UserRole)}
              disabled={isSelf}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee (Standard Passenger)</SelectItem>
                <SelectItem value="manager">Manager (Requisition Approver)</SelectItem>
                <SelectItem value="transport">Transport (Fleet & Driver Dispatcher)</SelectItem>
                <SelectItem value="admin">Administrator (Full System Control)</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-[11px] text-amber-600">
                Self-demotion protection: You cannot alter your own Administrator role.
              </p>
            )}
          </div>

          {/* Granular Permission Flags */}
          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-white">
            <div className="text-xs font-semibold text-gray-800 mb-2">
              Granular Permission Overrides
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <div>
                <span className="text-xs font-medium text-gray-900 block">Manage (Requisition Approval)</span>
                <span className="text-[11px] text-gray-500 block">Allows approving subordinate ride bookings</span>
              </div>
              <Switch
                checked={manage}
                onCheckedChange={setManage}
                disabled={role === "admin"}
              />
            </div>

            <div className="flex items-center justify-between py-1 border-b border-gray-100">
              <div>
                <span className="text-xs font-medium text-gray-900 block">Build (Requisition Booking)</span>
                <span className="text-[11px] text-gray-500 block">Allows generating departmental requisitions</span>
              </div>
              <Switch
                checked={build}
                onCheckedChange={setBuild}
                disabled={role === "admin"}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-xs font-medium text-gray-900 block">Tools (Transport Dispatch)</span>
                <span className="text-[11px] text-gray-500 block">Allows vehicle and driver assignment</span>
              </div>
              <Switch
                checked={tools}
                onCheckedChange={setTools}
                disabled={role === "admin"}
              />
            </div>
          </div>

          {/* Reporting Manager Assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-800">
              Designated Reporting Manager (Approver)
            </Label>
            <Select value={reportingTo} onValueChange={setReportingTo}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder={loadingManagers ? "Loading managers..." : "Select reporting manager"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">— None (Independent / Approver) —</SelectItem>
                {eligibleManagers.map((m) => (
                  <SelectItem key={m.username} value={m.username}>
                    {m.fullName} ({m.username}){m.department ? ` - ${m.department}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-500">
              Requisitions submitted by this employee will route to the designated manager for approval.
            </p>
          </div>

          {/* Account Status Toggle */}
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50/50">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-gray-900 flex items-center space-x-1.5">
                {active ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-red-600" />}
                <span>Account Status: {active ? "Active" : "Disabled"}</span>
              </Label>
              <span className="text-[11px] text-gray-500 block">
                {active
                  ? "User can authenticate and interact with portal according to assigned role."
                  : "Login is revoked; all active sessions will be terminated."}
              </span>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              disabled={isSelf}
            />
          </div>
          {isSelf && (
            <p className="text-[11px] text-amber-600">
              Self-lockout protection: You cannot deactivate your own administrative account.
            </p>
          )}

          {/* Dedicated Password Reset Section */}
          <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-950 flex items-center">
                  <KeyRound className="h-3.5 w-3.5 mr-1.5 text-blue-700" />
                  Credentials & Password Reset
                </span>
                <span className="text-[11px] text-blue-800 block mt-0.5">
                  Generates an encrypted temporary password and forces password change on next login.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="text-xs h-8 bg-white border-blue-200 text-blue-800 hover:bg-blue-100 font-medium"
              >
                {resettingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reset Password"}
              </Button>
            </div>

            {temporaryPassword && (
              <div className="bg-white border border-blue-300 rounded p-2.5 mt-2 space-y-1.5 shadow-xs">
                <span className="text-[11px] font-semibold text-blue-900 block">
                  One-Time Temporary Password (Copy Now):
                </span>
                <div className="flex items-center space-x-2">
                  <Input
                    readOnly
                    value={temporaryPassword}
                    className="font-mono text-xs font-bold bg-gray-50 h-8 text-blue-900 select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 mr-1 text-green-300" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-700 font-medium">
                  This temporary password will not be displayed again. Provide it securely to the employee.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Account Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
