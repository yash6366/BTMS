"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Car, Train, Plane, MapPin, User, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react"
import FormErrorBoundary from "@/components/FormErrorBoundary"
import { TaxiBookingSchema, FormValidator } from "@/lib/form-validation"

interface FormData {
  role: string
  name: string
  mobile?: string
  indenter?: string
  indenterMobile?: string
  designation?: string
  deptCode?: string
  otherDetails?: string
  pickupType: string
  pickupFields: Record<string, string>
  STATUS_APVR: string
  STAFF_NO_USER?: string
  INDENTER_NAME?: string
  timestamp?: string
}

type FieldDefinition = {
  name: string
  type: "text" | "select" | "textarea" | "date"
  options?: string[]
}

export default function TaxiBookingForm() {
  const [role, setRole] = useState("customer")
  const [pickupType, setPickupType] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<FormData>({
    role: "customer",
    name: "",
    mobile: "",
    indenter: "",
    indenterMobile: "",
    designation: "",
    deptCode: "",
    otherDetails: "",
    pickupType: "",
    pickupFields: {},
    STATUS_APVR: "OPEN",
    STAFF_NO_USER: "",
    INDENTER_NAME: "",
    timestamp: "",
  })

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/profile")
        const user = await res.json()
        setFormData((prev) => ({
          ...prev,
          STAFF_NO_USER: user.EMP_ID,
          INDENTER_NAME: user.EMP_LNAME,
          indenter: user.EMP_LNAME,
          designation: user.EMP_DESIGNATION || "",
        }))
      } catch (err) {
        console.error("Failed to fetch user info:", err)
      }
    }
    fetchUser()
  }, [])

  const handleFieldChange = useCallback((field: string, value: string) => {
    // Sanitize input for security
    const sanitizedValue = FormValidator.sanitizeInput(value)
    
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }))
    
    // Clear error for this field
    setErrors((prev) => ({ ...prev, [field]: "" }))
    
    // Real-time validation for specific fields
    if (["mobile", "indenterMobile", "name", "indenter"].includes(field)) {
      const timeoutId = setTimeout(() => {
        validateSingleField(field, sanitizedValue)
      }, 500) // Debounce validation
      
      // Cleanup previous timeout
      return () => clearTimeout(timeoutId)
    }
  }, [])

  const validateSingleField = (field: string, value: string) => {
    let isValid = true
    let errorMessage = ""

    switch (field) {
      case "mobile":
      case "indenterMobile":
        if (value && !/^[6-9]\d{9}$/.test(value)) {
          isValid = false
          errorMessage = "Please enter a valid 10-digit mobile number starting with 6-9"
        }
        break
      case "name":
      case "indenter":
        if (value.length < 2) {
          isValid = false
          errorMessage = "Must be at least 2 characters long"
        } else if (!/^[a-zA-Z0-9\s\.,'-]+$/.test(value)) {
          isValid = false
          errorMessage = "Contains invalid characters"
        }
        break
    }

    if (!isValid) {
      setErrors((prev) => ({ ...prev, [field]: errorMessage }))
    }
  }

  const handlePickupFieldChange = useCallback((field: string, value: string) => {
    // Extract employee ID if this is an approver field with format "ID - NAME"
    let finalValue = value
    if (field === "approver" && value.includes(" - ")) {
      finalValue = value.split(" - ")[0] // Extract just the employee ID
    }
    
    setFormData(prev => ({
      ...prev,
      pickupFields: {
        ...prev.pickupFields,
        [field]: finalValue,
      },
    }))
  }, [])

  const validateForm = () => {
    // Construct validation data
    const validationData = {
      role: formData.role as "customer" | "bhel" | "others",
      name: formData.name,
      mobile: formData.mobile,
      indenter: formData.indenter,
      indenterMobile: formData.indenterMobile,
      designation: formData.designation,
      deptCode: formData.deptCode,
      pickupType: formData.pickupType as "railway" | "airport" | "others",
      pickupFields: formData.pickupFields,
      otherDetails: formData.otherDetails,
    }

    const validation = FormValidator.validateForm(TaxiBookingSchema, validationData)
    
    if (!validation.success && validation.errors) {
      // Transform nested errors for display
      const transformedErrors: Record<string, string> = {}
      
      Object.entries(validation.errors).forEach(([key, value]) => {
        if (key.includes(".")) {
          // Handle nested field errors (e.g., pickupFields.date)
          const parts = key.split(".")
          if (parts[0] === "pickupFields") {
            transformedErrors[parts[1]] = value
          }
        } else {
          transformedErrors[key] = value
        }
      })
      
      setErrors(transformedErrors)
      return false
    }

    setErrors({})
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    if (!pickupType) {
      alert("Please select pickup type (Railway/Airport/Others)")
      return
    }

    const timestamp = new Date().toISOString()
    const finalData = {
      ...formData,
      STATUS_APVR: "OPEN",
      timestamp,
    }

    try {
      const response = await fetch("/api/ride-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalData),
      })
      
      const result = await response.json()
      
      if (response.ok) {
        const approverName = formData.pickupFields.approver === "6234070" ? "CHANDRIKA K SHANKAR" : "Manager B"
        alert(`Booking submitted successfully!\n\nBooking ID: ${result.serialNo}\nStatus: ${result.status}\n\nYour request has been sent to ${approverName} for approval. You will be notified once approved.`)
        
        // Reset form after successful submission
        setFormData({
          role: formData.role,
          name: "",
          mobile: "",
          indenter: formData.indenter,
          indenterMobile: "",
          designation: formData.designation,
          deptCode: "",
          otherDetails: "",
          pickupType: "",
          pickupFields: {},
          STATUS_APVR: "OPEN",
          STAFF_NO_USER: formData.STAFF_NO_USER,
          INDENTER_NAME: formData.INDENTER_NAME,
          timestamp: "",
        })
        setPickupType("")
        setErrors({})
      } else {
        alert(`Error submitting booking: ${result.error}`)
      }
    } catch (error) {
      console.error("Submission error:", error)
      alert("Submission failed. Please try again.")
    }
  }

  const renderIndenterDetails = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center">
          <ShieldCheck className="mr-2 h-4 w-4 text-purple-600" /> Indenter Details
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 grid grid-cols-2 gap-3">
        <InputBlock
          label="Indenter Name"
          value={formData.indenter}
          onChange={(val) => handleFieldChange("indenter", val)}
          error={errors.indenter}
          required
        />
        <InputBlock
          label="Indenter Mobile No."
          value={formData.indenterMobile}
          onChange={(val) => handleFieldChange("indenterMobile", val)}
          error={errors.indenterMobile}
          required
        />
      </CardContent>
    </Card>
  )

  const renderPersonDetails = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center">
          <User className="mr-2 h-4 w-4 text-blue-600" /> Person Travelling
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 grid grid-cols-2 gap-3">
        {role === "bhel" && (
          <>
            <InputBlock
              label="Designation"
              value={formData.designation}
              onChange={(val) => handleFieldChange("designation", val)}
              error={errors.designation}
              required
            />
            <InputBlock
              label="Department Code"
              value={formData.deptCode}
              onChange={(val) => handleFieldChange("deptCode", val)}
              error={errors.deptCode}
              required
            />
            <InputBlock
              label="Passenger Mobile No."
              value={formData.mobile}
              onChange={(val) => handleFieldChange("mobile", val)}
              error={errors.mobile}
              required
            />
          </>
        )}
        <InputBlock
          label="Name"
          value={formData.name}
          onChange={(val) => handleFieldChange("name", val)}
          error={errors.name}
          required
        />
        {role !== "bhel" && (
          <InputBlock
            label="Mobile No."
            value={formData.mobile}
            onChange={(val) => handleFieldChange("mobile", val)}
            error={errors.mobile}
            required
          />
        )}
        <TextBlock
          label="Other Details"
          value={formData.otherDetails}
          onChange={(val) => handleFieldChange("otherDetails", val)}
        />
      </CardContent>
    </Card>
  )

  const renderJourneyDetails = () => {
    const timeOptions = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`)
    const commonFields: FieldDefinition[] = [
      { name: "Date", type: "date" },
      { name: "Pick-Up Time", type: "select", options: timeOptions },
      { name: "Select Car", type: "select", options: ["Sedan A/C", "INNOVA CRYSTA A/c (7+1)", "Tempo traveller A/C"] },
      { name: "Duration", type: "select", options: ["1-4", "4-6", "6-8", "8-10", "10-12"] },
      { name: "Purpose", type: "textarea" },
      { name: "Approver", type: "select", options: [
        "3787702 - ANBALAGAN R", 
        "2206560 - BALAGANESAN", 
        "1894706 - BRAJA MOHAN SAHU",
        "6234070 - CHANDRIKA K SHANKAR", 
        "1274058 - DEEPA PRABHAKAR", 
        "1279904 - J P MAsand", 
        "3784878 - JAGDEESH KUMAR BISOI",
        "3783162 - LAKSHMINARAYANA S", 
        "3796078 - MARCY JACOB", 
        "3788334 - PRAKASH D", 
        "3788091 - PRASAD JVS", 
        "3788997 - RAJENDRA M PANDHARE",
        "3824144 - RAJU M V S N", 
        "3824624 - RENGANATHAN R", 
        "3786161 - SATYA BRATA BANIK", 
        "3787451 - SERALATHAN AT", 
        "3787443 - SKEKAR R",
        "3796035 - SHYAM BABU B", 
        "3784819 - SUDHA IYENGAR S"
      ] },
    ]

    let pickupSpecificFields: FieldDefinition[] = []
    if (pickupType === "railway") {
      pickupSpecificFields = [
        { name: "Station Name", type: "select", options: ["Bengaluru City Junction[SBC]", "Yesvantpur Junction[YPR]"] },
        { name: "Train No.", type: "text" },
        { name: "Drop at", type: "text" },
      ]
    } else if (pickupType === "airport") {
      pickupSpecificFields = [
        { name: "Airport Name", type: "select", options: ["Kempegowda International Airport (BLR)"] },
        { name: "Flight No.", type: "text" },
        { name: "Coming from", type: "text" },
        { name: "Drop at", type: "text" },
      ]
    } else if (pickupType === "others") {
      pickupSpecificFields = [
        { name: "From", type: "text" },
        { name: "To", type: "text" },
      ]
    }

    const allFields = [...pickupSpecificFields, ...commonFields]

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center">
            <Car className="mr-2 h-4 w-4 text-green-600" /> Journey Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div>
            <Label className="text-sm font-medium">Pick-Up From</Label>
            <RadioGroup
              value={pickupType}
              onValueChange={(val) => {
                setPickupType(val)
                setFormData((prev) => ({ ...prev, pickupType: val }))
              }}
              className="grid grid-cols-3 gap-2 mt-2"
            >
              {[
                { value: "railway", label: "Railway", icon: Train },
                { value: "airport", label: "Airport", icon: Plane },
                { value: "others", label: "Others", icon: MapPin },
              ].map(({ value, label, icon: Icon }) => (
                <div key={value} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-gray-50">
                  <RadioGroupItem value={value} id={value} />
                  <Label htmlFor={value} className="flex items-center space-x-1 cursor-pointer text-sm">
                    <Icon className="h-3 w-3" />
                    <span>{label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {pickupType && (
            <div className="grid grid-cols-2 gap-3">
              {allFields.map(({ name, type, options }) => {
                const fieldKey = name.toLowerCase().replace(/\s+/g, "_")
                return (
                  <div key={name} className={type === "textarea" ? "col-span-2" : ""}>
                    <Label className="text-sm">{name}</Label>
                    {type === "select" ? (
                      <Select onValueChange={(val) => handlePickupFieldChange(fieldKey, val)}>
                        <SelectTrigger className="mt-1 h-8">
                          <SelectValue placeholder={`Select ${name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options?.map((opt, i) => (
                            <SelectItem key={i} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : type === "textarea" ? (
                      <Textarea
                        className="mt-1 h-16"
                        onChange={(e) => handlePickupFieldChange(fieldKey, e.target.value)}
                      />
                    ) : (
                      <Input
                        type={type}
                        className="mt-1 h-8"
                        onChange={(e) => handlePickupFieldChange(fieldKey, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <FormErrorBoundary onReset={() => window.location.reload()}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Book a New Ride</h2>
          <p className="text-sm text-gray-600">Schedule your transportation with our easy booking system.</p>
        </div>

        {/* Form Validation Status */}
        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please fix the following errors:
              <ul className="mt-2 list-disc list-inside">
                {Object.entries(errors).slice(0, 3).map(([field, error]) => (
                  <li key={field} className="text-sm">{error}</li>
                ))}
                {Object.keys(errors).length > 3 && (
                  <li className="text-sm">...and {Object.keys(errors).length - 3} more</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Tabs
          defaultValue="customer"
          onValueChange={(val) => {
            setRole(val)
            setFormData((prev) => ({ ...prev, role: val }))
          }}
          className="w-full"
        >
        <TabsList className="grid w-full grid-cols-3 mb-4 h-9">
          {["customer", "bhel", "others"].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="flex items-center space-x-1 capitalize text-xs">
              <User className="h-3 w-3" />
              <span>{tab}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {["customer", "bhel", "others"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-0">
            {renderIndenterDetails()}
            {renderPersonDetails()}
            {renderJourneyDetails()}
            <div className="flex justify-center pt-2">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 px-6" onClick={handleSubmit}>
                Submit Booking
              </Button>
            </div>
          </TabsContent>
        ))}
        </Tabs>
      </div>
    </FormErrorBoundary>
  )
}

const InputBlock = memo(({
  label,
  value,
  onChange,
  error,
  required = false,
  readOnly = false,
  type = "text",
}: {
  label: string
  value?: string
  onChange: (val: string) => void
  error?: string
  required?: boolean
  readOnly?: boolean
  type?: string
}) => {
  const isValid = value && !error && value.length > 0
  const hasError = !!error

  return (
    <div>
      <Label className="text-sm flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {isValid && <CheckCircle className="w-3 h-3 text-green-500" />}
        {hasError && <AlertCircle className="w-3 h-3 text-red-500" />}
      </Label>
      <div className="relative">
        <Input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          readOnly={readOnly}
          className={`mt-1 h-8 ${
            hasError 
              ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
              : isValid 
                ? "border-green-500" 
                : ""
          }`}
          placeholder={readOnly ? "Auto-filled" : `Enter ${label.toLowerCase()}`}
        />
        {isValid && !readOnly && (
          <CheckCircle className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
})

const TextBlock = memo(({ label, value, onChange }: { label: string; value?: string; onChange: (val: string) => void }) => (
  <div className="col-span-2">
    <Label className="text-sm">{label}</Label>
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="mt-1" />
  </div>
))