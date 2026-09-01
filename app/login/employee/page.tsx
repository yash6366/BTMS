"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function EmployeeLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified login page
    router.replace("/login")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to unified login...</p>
      </div>
    </div>
  )
}