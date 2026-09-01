"use client"

import React from "react"
import { useAuth } from "@/hooks/use-auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Shield, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

interface RoleBasedAccessProps {
  requiredRole?: "employee" | "manager"
  requiredPermission?: "build" | "manage" | "tools"
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleBasedAccess({
  requiredRole,
  requiredPermission,
  fallback,
  children
}: RoleBasedAccessProps) {
  const { user, isLoading, isManager, isEmployee, hasPermission } = useAuth()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Alert className="m-4 border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="space-y-2">
            <p>Authentication required to access this resource.</p>
            <Button 
              onClick={() => router.push("/login")} 
              size="sm" 
              className="bg-red-600 hover:bg-red-700"
            >
              Login
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Check role-based access
  if (requiredRole === "manager" && !isManager()) {
    return fallback || (
      <Alert className="m-4 border-yellow-200 bg-yellow-50">
        <Shield className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <div className="space-y-2">
            <p>Manager access required. You don't have sufficient permissions to view this content.</p>
            <Button 
              onClick={() => router.push("/dashboard")} 
              size="sm" 
              variant="outline"
              className="border-yellow-600 text-yellow-600"
            >
              Go to Dashboard
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (requiredRole === "employee" && !isEmployee() && !isManager()) {
    return fallback || (
      <Alert className="m-4 border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="space-y-2">
            <p>Employee access required. Please login with valid credentials.</p>
            <Button 
              onClick={() => router.push("/login")} 
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              Login
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Check permission-based access
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || (
      <Alert className="m-4 border-orange-200 bg-orange-50">
        <Shield className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="space-y-2">
            <p>
              Insufficient permissions. You need "{requiredPermission}" permission to access this feature.
            </p>
            <Button 
              onClick={() => router.push("/dashboard")} 
              size="sm" 
              variant="outline"
              className="border-orange-600 text-orange-600"
            >
              Go to Dashboard
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return <>{children}</>
}

// Convenience components for specific roles
export function EmployeeOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedAccess requiredRole="employee" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  )
}

export function ManagerOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedAccess requiredRole="manager" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  )
}

// Permission-based components
export function RequirePermission({ 
  permission, 
  children, 
  fallback 
}: { 
  permission: "build" | "manage" | "tools"
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  return (
    <RoleBasedAccess requiredPermission={permission} fallback={fallback}>
      {children}
    </RoleBasedAccess>
  )
}