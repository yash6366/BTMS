"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import { Loader2, UserPlus, Copy, Check, AlertTriangle, KeyRound } from "lucide-react"
import type { AdminEmployeeItem } from "@/lib/auth"
import type { UserRole } from "@/types"

interface ProvisionUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: AdminEmployeeItem | null
  onProvisionSuccess: () => void
}

export function ProvisionUserModal({
  open,
  onOpenChange,
  employee,
  onProvisionSuccess,
}: ProvisionUserModalProps) {
  const [role, setRole] = useState<UserRole>("employee")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!employee) return null

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/users/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empId: employee.empId,
          role,
        }),
      })

      const data = await res.json()
      if (res.ok && data.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword)
        onProvisionSuccess()
      } else {
        setError(data.error || "Failed to provision portal account.")
      }
    } catch {
      setError("Network error while provisioning account.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTemporaryPassword(null)
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center space-x-2 text-gray-900">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <span>Provision Portal Account ({employee.empId})</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create an active authentication account for an onboarded BHEL employee from the Master Directory.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {temporaryPassword ? (
          <div className="space-y-3 py-2">
            <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-3 rounded-md">
              Account created successfully! Provide this temporary password to <strong>{employee.fullName}</strong>.
            </div>

            <div className="bg-white border border-blue-300 rounded p-3 space-y-2 shadow-xs">
              <span className="text-xs font-semibold text-blue-900 block flex items-center">
                <KeyRound className="h-3.5 w-3.5 mr-1.5 text-blue-700" />
                Temporary Access Credential:
              </span>
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  value={temporaryPassword}
                  className="font-mono text-sm font-bold bg-gray-50 h-9 text-blue-900 select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopy}
                  className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5 mr-1 text-green-300" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-amber-700 font-medium">
                The user will be required to choose a new password upon first sign-in.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" size="sm" onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleProvision} className="space-y-3.5 py-1">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee Name:</span>
                <span className="font-semibold text-slate-900">{employee.fullName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="text-slate-800">{employee.department}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Designation:</span>
                <span className="text-slate-800">{employee.designation || "Staff"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Official Email:</span>
                <span className="text-slate-800">{employee.email || "—"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-800">
                Initial Account Role *
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select initial role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee (Standard Passenger)</SelectItem>
                  <SelectItem value="manager">Manager (Requisition Approver)</SelectItem>
                  <SelectItem value="transport">Transport (Fleet & Dispatcher)</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Provision & Generate Password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
