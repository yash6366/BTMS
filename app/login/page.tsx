"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Header } from "@/components/layout/header"
import { Loader2, LogIn, AlertCircle, CheckCircle } from "lucide-react"

export default function UnifiedLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
    if (error) setError("")
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!formData.username || !formData.password) {
      setError("Please enter both user ID and password")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/unified-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username: formData.username, 
          password: formData.password
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess("Login successful! Redirecting...")
        
        // Use role-based redirection from API response
        const redirectPath = data.redirectTo || "/dashboard"
        setTimeout(() => {
          router.push(redirectPath)
          router.refresh()
        }, 1500)
      } else {
        setError(data.error || "Login failed")
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="BHEL Transport Services" subtitle="Unified Login Portal" showBackButton backHref="/" />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <LogIn className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">BHEL Login</CardTitle>
              <CardDescription>Access BHEL Transport Services Portal</CardDescription>
            </CardHeader>

            <CardContent>
              {/* Error Alert */}
              {error && (
                <Alert className="mb-6 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Alert */}
              {success && (
                <Alert className="mb-6 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                {/* Username Field */}
                <div className="space-y-2">
                  <Label htmlFor="username">
                    User ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    placeholder="Enter your user ID"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                {/* Submit Button */}
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              {/* Additional Links & Registration */}
              <div className="mt-6 space-y-3 text-center text-sm">
                <div className="flex justify-between text-xs">
                  <a href="#" className="text-blue-600 hover:underline">
                    Forgot Password?
                  </a>
                  <a href="#" className="text-blue-600 hover:underline">
                    Need Help?
                  </a>
                </div>

                {/* Registration CTA for New Employees */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 mb-2 text-xs">New Employee or Staff Member?</p>
                  <Button variant="outline" asChild className="w-full text-blue-700 border-blue-200 hover:bg-blue-50">
                    <Link href="/signup">
                      Register / Create an Account
                    </Link>
                  </Button>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-gray-600 text-xs">For technical assistance, contact BHEL IT Helpdesk</p>
                  <p className="text-gray-600 font-medium text-xs">📞 080-26989206 | 📧 it.support@bhel.in</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="mt-6 bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-start">
                <div className="text-yellow-600 mr-2">⚠️</div>
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Security Notice:</p>
                  <p>
                    This is a secure BHEL system. Unauthorized access is prohibited and monitored. 
                    All users (Employees, Managers, Transport) access through this unified portal with features based on their role and permissions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>



          {/* Role Information */}
          <Card className="mt-4 bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="text-sm text-green-800">
                <p className="font-semibold mb-2">Automatic Role Detection:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Employees:</strong> Access to booking system and ride history</li>
                  <li>• <strong>Managers:</strong> All employee features + approval system access</li>
                  <li>• <strong>Transport:</strong> Manage pending and passed ride requests</li>
                  <li>• Single dashboard for all users with role-based features</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="container mx-auto px-6 text-center">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <p className="text-sm text-gray-600">© 2025 Bharat Heavy Electricals Limited. All rights reserved.</p>
            <div className="flex space-x-4 text-sm text-gray-600">
              <a href="#" className="hover:text-blue-600">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-blue-600">
                Terms of Service
              </a>
              <a href="#" className="hover:text-blue-600">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}