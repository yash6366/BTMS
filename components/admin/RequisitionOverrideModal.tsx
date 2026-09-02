"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { AdminRequisitionItem } from "@/lib/admin-transport-service"

interface RequisitionOverrideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requisition: AdminRequisitionItem | null
  onOverrideSuccess: () => void
}

export function RequisitionOverrideModal({
  open,
  onOpenChange,
  requisition,
  onOverrideSuccess,
}: RequisitionOverrideModalProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  if (!requisition) return null

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a detailed justification (at least 5 characters) for this administrative override.")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch(`/api/admin/requisitions/${encodeURIComponent(requisition.serialNo)}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message || "Requisition successfully force-approved.")
        onOverrideSuccess()
        setTimeout(() => {
          onOpenChange(false)
          setReason("")
          setSuccess("")
        }, 1200)
      } else {
        setError(data.error || "Failed to force-approve requisition.")
      }
    } catch {
      setError("Network error while submitting administrative override.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center space-x-2 text-gray-900">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <span>Administrator Force-Approval (Override)</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bypass standard manager approval workflow and directly elevate requisition to the Transport Desk for fleet dispatch.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-md flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-3 rounded-md flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleOverride} className="space-y-3.5 py-1">
          {/* Requisition Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Requisition Serial:</span>
              <span className="font-mono font-bold text-slate-900">{requisition.serialNo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Passenger:</span>
              <span className="font-semibold text-slate-900">{requisition.passengerName} ({requisition.staffNo})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Route:</span>
              <span className="text-slate-800">{requisition.startingPlace} &rarr; {requisition.destination}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Trip Schedule:</span>
              <span className="font-medium text-slate-900">
                {requisition.tripDate ? new Date(requisition.tripDate).toLocaleDateString() : "Immediate"} at {requisition.tripTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Current Approver State:</span>
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 uppercase font-bold">
                {requisition.statusApprover}
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-800">
              Administrative Justification (Mandatory Audit Trail) *
            </Label>
            <Textarea
              rows={3}
              placeholder="e.g., Authorized per General Manager oral instructions; designated approver is on emergency leave."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs resize-none"
              required
            />
            <p className="text-[11px] text-gray-500">
              This reason will be stamped into the booking audit log and visible on the transport pass.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Confirm Force-Approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
