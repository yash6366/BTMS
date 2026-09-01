"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Loader2, 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  LogIn,
  Building2,
  Shield
} from "lucide-react"

interface VerifiedEmployee {
  empId: string
  firstName: string
  middleName?: string
  lastName: string
  designation: string
  email: string
  department: string
  fullName: string
}

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string>("")
  const [successStatus, setSuccessStatus] = useState<"ACTIVE" | "PENDING_REVIEW" | null>(null)

  // Step 1 Form Data (Identity Verification)
  const [staffNo, setStaffNo] = useState("")
  const [officialEmail, setOfficialEmail] = useState("")
  const [verifiedEmployee, setVerifiedEmployee] = useState<VerifiedEmployee | null>(null)

  // Step 2 Form Data (Profile Contact)
  const [mobile, setMobile] = useState("")
  const [reportingTo, setReportingTo] = useState("")

  // Step 3 Form Data (Security & Access)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [requestedRole, setRequestedRole] = useState<"employee" | "manager" | "transport">("employee")

  // Step 4 Form Data (Declaration)
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Real-time password criteria
  const passwordCriteria = {
    hasLength: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&#^~_+-]/.test(password),
  }

  const isPasswordValid = 
    passwordCriteria.hasLength &&
    passwordCriteria.hasUpper &&
    passwordCriteria.hasLower &&
    passwordCriteria.hasNumber &&
    passwordCriteria.hasSpecial

  const doPasswordsMatch = password.length > 0 && password === confirmPassword

  // Clear errors when inputs change
  const handleInputChange = (setter: (val: string) => void, val: string) => {
    setter(val)
    if (error) setError("")
  }

  // ----------------------------------------------------
  // STEP 1: Verify Identity against Master Directory
  // ----------------------------------------------------
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!staffNo.trim() || !officialEmail.trim()) {
      setError("Please enter both Staff Number and official BHEL email address.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/verify-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffNo: staffNo.trim(),
          officialEmail: officialEmail.trim().toLowerCase(),
        }),
      })

      const data = await response.json()

      if (response.ok && data.verified && data.employee) {
        setVerifiedEmployee(data.employee)
        setCurrentStep(2)
      } else {
        setError(data.error || "Employee verification failed. Please check your Staff Number and email.")
      }
    } catch (err) {
      console.error("Verification error:", err)
      setError("Unable to connect to verification service. Please check your network.")
    } finally {
      setIsLoading(false)
    }
  }

  // ----------------------------------------------------
  // STEP 2: Validate Contact Details
  // ----------------------------------------------------
  const handleContinueProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const cleanMobile = mobile.replace(/\D/g, "")
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setError("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.")
      return
    }

    setCurrentStep(3)
  }

  // ----------------------------------------------------
  // STEP 3: Validate Security & Role Configuration
  // ----------------------------------------------------
  const handleContinueSecurity = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isPasswordValid) {
      setError("Password must meet all security requirements (at least 12 characters, uppercase, lowercase, number, and special character).")
      return
    }

    if (!doPasswordsMatch) {
      setError("Password confirmation does not match.")
      return
    }

    setCurrentStep(4)
  }

  // ----------------------------------------------------
  // STEP 4: Final Submission
  // ----------------------------------------------------
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!acceptTerms) {
      setError("You must accept the BHEL Transport & IT Security compliance declaration.")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffNo: staffNo.trim(),
          officialEmail: officialEmail.trim().toLowerCase(),
          mobile: mobile.replace(/\D/g, ""),
          password,
          confirmPassword,
          requestedRole,
          reportingTo: reportingTo.trim() || undefined,
          acceptTerms: true,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessStatus(data.status || "ACTIVE")
        setCurrentStep(5)
      } else {
        setError(data.error || "Registration failed. Please review your details and try again.")
      }
    } catch (err) {
      console.error("Signup error:", err)
      setError("Network error during registration. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Stepper Header Items
  const steps = [
    { num: 1, title: "Identity", icon: UserCheck },
    { num: 2, title: "Profile", icon: Building2 },
    { num: 3, title: "Security", icon: KeyRound },
    { num: 4, title: "Review", icon: FileCheck },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="BHEL Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">BHEL Transport Services</h1>
                <p className="text-xs text-gray-600">Employee & Staff Portal Registration</p>
              </div>
            </div>

            <Button variant="outline" asChild size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl">
          
          {/* Stepper Progress Indicator (Only on steps 1-4) */}
          {currentStep <= 4 && (
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {steps.map((step, idx) => {
                  const StepIcon = step.icon
                  const isCompleted = currentStep > step.num
                  const isCurrent = currentStep === step.num

                  return (
                    <div key={step.num} className="flex-1 flex items-center">
                      <div className="flex flex-col items-center mx-auto">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                            isCompleted
                              ? "bg-green-600 text-white"
                              : isCurrent
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                        </div>
                        <span
                          className={`mt-2 text-xs font-medium ${
                            isCurrent ? "text-blue-900 font-bold" : "text-gray-500"
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div
                          className={`h-0.5 w-full mx-2 -mt-4 transition-colors ${
                            currentStep > step.num ? "bg-green-600" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Global Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
            </Alert>
          )}

          {/* ======================================================== */}
          {/* STEP 1: IDENTITY VERIFICATION                            */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Verify BHEL Employee Identity</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Enter your Staff Number and official corporate email to verify your identity from the Master Directory.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleVerifyIdentity} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="staffNo" className="text-sm font-medium text-gray-700">
                      Staff Number (User ID) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="staffNo"
                      type="text"
                      placeholder="e.g. 6234070 or 6299001"
                      value={staffNo}
                      onChange={(e) => handleInputChange(setStaffNo, e.target.value)}
                      disabled={isLoading}
                      autoComplete="username"
                      required
                    />
                    <p className="text-xs text-gray-500">Your unique 6 to 10 character BHEL employee identification number.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officialEmail" className="text-sm font-medium text-gray-700">
                      Official BHEL Email ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="officialEmail"
                      type="email"
                      placeholder="name@bhel.in"
                      value={officialEmail}
                      onChange={(e) => handleInputChange(setOfficialEmail, e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                      required
                    />
                    <p className="text-xs text-gray-500">Must match the registered email in the BHEL Employee Directory.</p>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200 text-blue-900 text-xs py-3">
                    <Shield className="h-4 w-4 text-blue-600 mr-2 inline" />
                    <span>
                      <strong>Identity Guard:</strong> Account creation is restricted to personnel registered in the BHEL Employee Master. Your profile attributes will be synchronized securely.
                    </span>
                  </Alert>

                  <Button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying Master Directory...
                      </>
                    ) : (
                      <>
                        Verify Employee Identity
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
                  Already have an active account?{" "}
                  <Link href="/login" className="text-blue-600 font-medium hover:underline">
                    Sign in here
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* STEP 2: VERIFIED EMPLOYEE PROFILE & CONTACT              */}
          {/* ======================================================== */}
          {currentStep === 2 && verifiedEmployee && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <UserCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Verified Employee Profile</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Identity verified against BHEL Master Directory. Please provide your contact number.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleContinueProfile} className="space-y-5">
                  {/* Verified Canonical Directory Attributes (Read-Only) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Master Directory Record</span>
                      <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-gray-500 block">Full Name</span>
                        <span className="font-semibold text-gray-900">{verifiedEmployee.fullName}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Staff Number</span>
                        <span className="font-semibold text-gray-900">{verifiedEmployee.empId}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Department</span>
                        <span className="font-medium text-gray-800">{verifiedEmployee.department || "General"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Designation</span>
                        <span className="font-medium text-gray-800">{verifiedEmployee.designation || "Staff"}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs text-gray-500 block">Official Email</span>
                        <span className="font-medium text-gray-800">{verifiedEmployee.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Editable Contact Fields */}
                  <div className="space-y-2">
                    <Label htmlFor="mobile" className="text-sm font-medium text-gray-700">
                      Mobile Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm font-medium">+91</span>
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="9876543210"
                        value={mobile}
                        onChange={(e) => handleInputChange(setMobile, e.target.value)}
                        className="pl-12"
                        maxLength={10}
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500">10-digit mobile number for transport SMS alerts and driver coordination.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reportingTo" className="text-sm font-medium text-gray-700">
                      Reporting Officer / Approver Staff ID <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      id="reportingTo"
                      type="text"
                      placeholder="e.g. 3787702"
                      value={reportingTo}
                      onChange={(e) => handleInputChange(setReportingTo, e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Default approver staff number for after-hours and special ride requisitions.</p>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="w-1/3"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button type="submit" className="w-2/3 bg-blue-600 hover:bg-blue-700">
                      Continue to Security
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* STEP 3: SECURITY CREDENTIALS & ACCESS LEVEL              */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <KeyRound className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Security & Account Access</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Set a secure password and choose your portal profile.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleContinueSecurity} className="space-y-5">
                  {/* Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => handleInputChange(setPassword, e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Criteria Checklist */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5 text-xs">
                    <span className="font-semibold text-gray-700 block mb-1">Password Requirements:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <div className={`flex items-center ${passwordCriteria.hasLength ? "text-green-700 font-medium" : "text-gray-500"}`}>
                        <span className="mr-1.5">{passwordCriteria.hasLength ? "✓" : "○"}</span> At least 12 characters
                      </div>
                      <div className={`flex items-center ${passwordCriteria.hasUpper ? "text-green-700 font-medium" : "text-gray-500"}`}>
                        <span className="mr-1.5">{passwordCriteria.hasUpper ? "✓" : "○"}</span> Uppercase letter (A-Z)
                      </div>
                      <div className={`flex items-center ${passwordCriteria.hasLower ? "text-green-700 font-medium" : "text-gray-500"}`}>
                        <span className="mr-1.5">{passwordCriteria.hasLower ? "✓" : "○"}</span> Lowercase letter (a-z)
                      </div>
                      <div className={`flex items-center ${passwordCriteria.hasNumber && passwordCriteria.hasSpecial ? "text-green-700 font-medium" : "text-gray-500"}`}>
                        <span className="mr-1.5">{passwordCriteria.hasNumber && passwordCriteria.hasSpecial ? "✓" : "○"}</span> Number & Special char
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirm Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => handleInputChange(setConfirmPassword, e.target.value)}
                        className="pr-10"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && (
                      <p className={`text-xs ${doPasswordsMatch ? "text-green-600 font-medium" : "text-red-600"}`}>
                        {doPasswordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                      </p>
                    )}
                  </div>

                  {/* Access Level / Role Selection */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-semibold text-gray-900 block">
                      Portal Access Level <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      value={requestedRole}
                      onValueChange={(val: "employee" | "manager" | "transport") => setRequestedRole(val)}
                      className="space-y-2.5"
                    >
                      <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${requestedRole === "employee" ? "border-blue-600 bg-blue-50/50" : "border-gray-200 bg-white"}`}>
                        <RadioGroupItem value="employee" id="role-employee" className="mt-1" />
                        <div className="text-sm">
                          <Label htmlFor="role-employee" className="font-semibold text-gray-900 cursor-pointer">
                            Standard Employee Account <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2 font-medium">Instant Activation</span>
                          </Label>
                          <p className="text-xs text-gray-600 mt-0.5">Book official cabs, manage journey requests, view travel history.</p>
                        </div>
                      </div>

                      <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${requestedRole === "manager" ? "border-blue-600 bg-blue-50/50" : "border-gray-200 bg-white"}`}>
                        <RadioGroupItem value="manager" id="role-manager" className="mt-1" />
                        <div className="text-sm">
                          <Label htmlFor="role-manager" className="font-semibold text-gray-900 cursor-pointer">
                            Manager / Approver Access <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded ml-2 font-medium">Requires Admin Authorization</span>
                          </Label>
                          <p className="text-xs text-gray-600 mt-0.5">Standard features + requisition approval privileges for team members.</p>
                        </div>
                      </div>

                      <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${requestedRole === "transport" ? "border-blue-600 bg-blue-50/50" : "border-gray-200 bg-white"}`}>
                        <RadioGroupItem value="transport" id="role-transport" className="mt-1" />
                        <div className="text-sm">
                          <Label htmlFor="role-transport" className="font-semibold text-gray-900 cursor-pointer">
                            Transport Operations Staff <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded ml-2 font-medium">Requires Admin Authorization</span>
                          </Label>
                          <p className="text-xs text-gray-600 mt-0.5">Fleet allocation, driver assignment, and transport pool management.</p>
                        </div>
                      </div>
                    </RadioGroup>

                    {requestedRole !== "employee" && (
                      <Alert className="bg-amber-50 border-amber-200 text-amber-900 text-xs py-2.5">
                        <Clock className="h-4 w-4 text-amber-600 mr-2 inline" />
                        <span>
                          <strong>Authorization Notice:</strong> Elevated role requests require verification by the Transport Department administrator before account activation.
                        </span>
                      </Alert>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="w-1/3"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isPasswordValid || !doPasswordsMatch}
                      className="w-2/3 bg-blue-600 hover:bg-blue-700"
                    >
                      Review & Submit
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* STEP 4: REVIEW & DECLARATION                             */}
          {/* ======================================================== */}
          {currentStep === 4 && verifiedEmployee && (
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <FileCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">Review & Confirm Registration</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  Please verify your information before final submission.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmitRegistration} className="space-y-5">
                  <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Staff Number</span>
                      <span className="font-semibold text-gray-900">{verifiedEmployee.empId}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Employee Name</span>
                      <span className="font-semibold text-gray-900">{verifiedEmployee.fullName}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Department / Designation</span>
                      <span className="font-medium text-gray-800">{verifiedEmployee.department} · {verifiedEmployee.designation}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Official Email</span>
                      <span className="font-medium text-gray-800">{verifiedEmployee.email}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Mobile Number</span>
                      <span className="font-medium text-gray-800">+91 {mobile}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Access Profile</span>
                      <span className="font-semibold capitalize text-blue-900">{requestedRole} Account</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-gray-500">Activation Status</span>
                      <span className={`font-semibold text-xs px-2 py-0.5 rounded ${requestedRole === "employee" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                        {requestedRole === "employee" ? "Immediate Activation" : "Pending Administrator Review"}
                      </span>
                    </div>
                  </div>

                  {/* Declaration & Terms Checkbox */}
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <Checkbox
                      id="acceptTerms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="acceptTerms" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
                      I confirm that the above information is accurate and that I agree to abide by the BHEL Transport Requisition and IT Security Policies. Unauthorized access or falsification is strictly prohibited.
                    </Label>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      disabled={isLoading}
                      className="w-1/3"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={!acceptTerms || isLoading}
                      className="w-2/3 bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registering Account...
                        </>
                      ) : (
                        "Submit Registration"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ======================================================== */}
          {/* STEP 5: REGISTRATION COMPLETE STATUS                     */}
          {/* ======================================================== */}
          {currentStep === 5 && (
            <Card className="shadow-sm border-gray-200 text-center">
              <CardContent className="pt-8 pb-8 space-y-6">
                {successStatus === "ACTIVE" ? (
                  <>
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-gray-900">Registration Successful!</h2>
                      <p className="text-gray-600 text-sm max-w-md mx-auto">
                        Your BHEL Transport Portal account is active. You can now sign in using your Staff Number and password.
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-sm mx-auto text-left text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Staff Number:</span>
                        <span className="font-semibold text-gray-900">{staffNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Status:</span>
                        <span className="text-green-700 font-semibold">Active</span>
                      </div>
                    </div>

                    <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 px-8">
                      <Link href="/login">
                        <LogIn className="mr-2 h-5 w-5" />
                        Proceed to Login
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full mx-auto flex items-center justify-center">
                      <Clock className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-gray-900">Registration Submitted</h2>
                      <p className="text-gray-600 text-sm max-w-md mx-auto">
                        Your account has been registered successfully. Elevated role authorization has been submitted for administrator review.
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-sm mx-auto text-left text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Staff Number:</span>
                        <span className="font-semibold text-gray-900">{staffNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Requested Access:</span>
                        <span className="font-semibold capitalize text-blue-900">{requestedRole}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Status:</span>
                        <span className="text-amber-700 font-semibold">Pending Review</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      You will be notified once the Transport Department administrator approves your elevated permissions.
                    </p>

                    <Button asChild variant="outline" size="lg">
                      <Link href="/login">
                        Return to Login
                      </Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="container mx-auto px-6 text-center text-xs text-gray-600 space-y-2">
          <p className="font-medium text-gray-700">For registration or credential assistance, contact BHEL IT Helpdesk</p>
          <p>📞 080-26989206 | 📧 it.support@bhel.in</p>
          <p className="text-gray-400 pt-2">© 2025 Bharat Heavy Electricals Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
