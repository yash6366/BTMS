"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@/types"

// Simple client-side cache for user data
let userCache: { user: User | null; timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache && userCache && (Date.now() - userCache.timestamp) < CACHE_DURATION) {
      setUser(userCache.user)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          'Cache-Control': 'max-age=300' // 5 minutes
        }
      })
      const data = await res.json()

      if (res.ok && data.user) {
        setUser(data.user)
        // Cache the user data
        userCache = {
          user: data.user,
          timestamp: Date.now()
        }
      } else {
        setUser(null)
        userCache = {
          user: null,
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      // Clear cache on logout
      userCache = null
      router.push("/")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const requireAuth = (requiredRole?: string) => {
    if (!user) {
      router.push("/login")
      return false
    }

    if (requiredRole === "manager" && user.permissions?.manage !== true) {
      router.push("/dashboard")
      return false
    }

    return true
  }

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch("/api/auth/unified-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        
        // Redirect based on user type and role
        if (data.redirectTo) {
          router.push(data.redirectTo)
        } else {
          // Fallback logic
          if (data.user?.role === "transport") {
            router.push("/transport-dashboard")
          } else if (data.user?.role === "manager") {
            router.push("/manager-dashboard")
          } else {
            router.push("/dashboard")
          }
        }
        
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.error || "Login failed" }
      }
    } catch (error) {
      console.error("Login failed:", error)
      return { success: false, error: "Network error. Please try again." }
    }
  }

  const hasPermission = (permission: "build" | "manage" | "tools") => {
    return user?.permissions?.[permission] === true
  }

  const isManager = () => {
    return user?.permissions?.manage === true || user?.role === "manager"
  }

  const isEmployee = () => {
    return !isManager() && !isTransport() && !!user
  }

  const isTransport = () => {
    return user?.role === "transport" || user?.usertype === "transport"
  }

  return {
    user,
    isLoading,
    login,
    logout,
    requireAuth,
    hasPermission,
    isManager,
    isEmployee,
    isTransport,
    isAuthenticated: !!user,

    // Convenient accessors
    empId: user?.EMP_ID || user?.username || "",
    empEmail: user?.EMP_EMAIL_ID || user?.email || "",
    empDesignation: user?.EMP_DESIGNATION || "",
    empFirstName: user?.firstName || "",
    empLastName: user?.lastName || "",
    empMiddleName: user?.middleName || "",
    empFullName: user?.fullName || "",
  }
}
