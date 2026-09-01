import { z } from "zod"

// Common validation patterns
export const ValidationPatterns = {
  // Indian mobile number (10 digits)
  INDIAN_MOBILE: /^[6-9]\d{9}$/,
  // International mobile (with country code)
  INTERNATIONAL_MOBILE: /^\+(?:\d{1,3})?[-.\s]?\d{1,14}$/,
  // Email validation (more comprehensive)
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Strong password
  STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  // Employee ID patterns
  EMPLOYEE_ID: /^[A-Z0-9]{6,10}$/,
  // Department code
  DEPT_CODE: /^[A-Z]{2,6}$/,
  // Train number
  TRAIN_NUMBER: /^\d{5}$/,
  // Flight number
  FLIGHT_NUMBER: /^[A-Z]{2}\d{3,4}$/,
  // No special characters (for names, addresses)
  NO_SPECIAL_CHARS: /^[a-zA-Z0-9\s\.,'-]+$/,
  // Alphanumeric with spaces
  ALPHANUMERIC_SPACES: /^[a-zA-Z0-9\s]+$/,
}

// Custom error messages
export const ValidationMessages = {
  REQUIRED: "This field is required",
  INVALID_EMAIL: "Please enter a valid email address",
  INVALID_MOBILE: "Please enter a valid 10-digit mobile number",
  INVALID_INTERNATIONAL_MOBILE: "Please enter a valid mobile number with country code",
  WEAK_PASSWORD: "Password must contain at least 8 characters including uppercase, lowercase, number, and special character",
  INVALID_EMPLOYEE_ID: "Employee ID must be 6-10 alphanumeric characters",
  INVALID_DEPT_CODE: "Department code must be 2-6 uppercase letters",
  INVALID_TRAIN_NUMBER: "Train number must be 5 digits",
  INVALID_FLIGHT_NUMBER: "Flight number must be 2 letters followed by 3-4 digits",
  INVALID_CHARACTERS: "This field contains invalid characters",
  TOO_SHORT: (min: number) => `Must be at least ${min} characters`,
  TOO_LONG: (max: number) => `Must not exceed ${max} characters`,
  MIN_VALUE: (min: number) => `Value must be at least ${min}`,
  MAX_VALUE: (max: number) => `Value must not exceed ${max}`,
  DATE_TOO_EARLY: "Date cannot be in the past",
  DATE_TOO_LATE: "Date is too far in the future",
}

// Base schemas
export const BaseSchemas = {
  nonEmptyString: z.string().trim().min(1, ValidationMessages.REQUIRED),
  
  email: z.string()
    .email(ValidationMessages.INVALID_EMAIL)
    .max(100, ValidationMessages.TOO_LONG(100)),

  indianMobile: z.string()
    .regex(ValidationPatterns.INDIAN_MOBILE, ValidationMessages.INVALID_MOBILE),

  internationalMobile: z.string()
    .regex(ValidationPatterns.INTERNATIONAL_MOBILE, ValidationMessages.INVALID_INTERNATIONAL_MOBILE),

  employeeId: z.string()
    .regex(ValidationPatterns.EMPLOYEE_ID, ValidationMessages.INVALID_EMPLOYEE_ID),

  departmentCode: z.string()
    .regex(ValidationPatterns.DEPT_CODE, ValidationMessages.INVALID_DEPT_CODE),

  trainNumber: z.string()
    .regex(ValidationPatterns.TRAIN_NUMBER, ValidationMessages.INVALID_TRAIN_NUMBER),

  flightNumber: z.string()
    .regex(ValidationPatterns.FLIGHT_NUMBER, ValidationMessages.INVALID_FLIGHT_NUMBER),

  safeText: z.string()
    .regex(ValidationPatterns.NO_SPECIAL_CHARS, ValidationMessages.INVALID_CHARACTERS),

  futureDate: z.string()
    .refine((date) => {
      const selectedDate = new Date(date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return selectedDate >= today
    }, ValidationMessages.DATE_TOO_EARLY),

  reasonableDate: z.string()
    .refine((date) => {
      const selectedDate = new Date(date)
      const maxDate = new Date()
      maxDate.setMonth(maxDate.getMonth() + 6) // 6 months from now
      return selectedDate <= maxDate
    }, ValidationMessages.DATE_TOO_LATE),
}

// Taxi booking form validation schema
export const TaxiBookingSchema = z.object({
  // User information
  role: z.enum(["customer", "bhel", "others"]),
  name: BaseSchemas.nonEmptyString
    .min(2, ValidationMessages.TOO_SHORT(2))
    .max(50, ValidationMessages.TOO_LONG(50))
    .regex(ValidationPatterns.NO_SPECIAL_CHARS, ValidationMessages.INVALID_CHARACTERS),

  mobile: BaseSchemas.indianMobile.optional(),
  
  // Indenter information
  indenter: BaseSchemas.nonEmptyString
    .min(2, ValidationMessages.TOO_SHORT(2))
    .max(50, ValidationMessages.TOO_LONG(50)),

  indenterMobile: BaseSchemas.indianMobile,

  // BHEL-specific fields
  designation: z.string().optional(),
  deptCode: z.string().optional(),

  // Journey details
  pickupType: z.enum(["railway", "airport", "others"], {
    required_error: "Please select pickup type",
  }),

  // Dynamic fields based on pickup type
  pickupFields: z.object({
    // Date and time
    date: BaseSchemas.futureDate.pipe(BaseSchemas.reasonableDate),
    "pick-up_time": z.string().min(1, "Please select pickup time"),
    "select_car": z.string().min(1, "Please select a car type"),
    duration: z.string().min(1, "Please select duration"),
    purpose: BaseSchemas.nonEmptyString
      .min(3, ValidationMessages.TOO_SHORT(3))
      .max(200, ValidationMessages.TOO_LONG(200)),
    approver: z.string().min(1, "Please select an approver"),

    // Railway specific
    "station_name": z.string().optional(),
    "train_no.": z.string().optional(),
    "drop_at": z.string().optional(),

    // Airport specific
    "airport_name": z.string().optional(),
    "flight_no.": z.string().optional(),
    "coming_from": z.string().optional(),

    // Others specific
    "from": z.string().optional(),
    "to": z.string().optional(),
  }),

  // Optional fields
  otherDetails: z.string().max(500, ValidationMessages.TOO_LONG(500)).optional(),
})
.refine((data) => {
  // Role-specific validation
  if (data.role === "bhel") {
    return !!(data.designation && data.deptCode && data.mobile)
  }
  if (data.role === "customer" || data.role === "others") {
    return !!data.mobile
  }
  return true
}, {
  message: "Missing required fields for selected role",
  path: ["role"],
})
.refine((data) => {
  // Pickup-specific field validation
  if (data.pickupType === "railway") {
    return !!(data.pickupFields["station_name"] && 
              data.pickupFields["train_no."] && 
              data.pickupFields["drop_at"])
  }
  if (data.pickupType === "airport") {
    return !!(data.pickupFields["airport_name"] && 
              data.pickupFields["flight_no."] && 
              data.pickupFields["coming_from"] && 
              data.pickupFields["drop_at"])
  }
  if (data.pickupType === "others") {
    return !!(data.pickupFields["from"] && data.pickupFields["to"])
  }
  return true
}, {
  message: "Missing required pickup-specific fields",
  path: ["pickupFields"],
})

// Login form validation
export const LoginSchema = z.object({
  username: BaseSchemas.nonEmptyString
    .min(3, ValidationMessages.TOO_SHORT(3))
    .max(50, ValidationMessages.TOO_LONG(50)),
  
  password: BaseSchemas.nonEmptyString
    .min(4, ValidationMessages.TOO_SHORT(4)),

  userType: z.enum(["employee", "manager"]).optional(),
})

// Strong password pattern: At least 12 chars with upper, lower, number, special char
export const STRONG_PASSWORD_12_PLUS = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^~_+-])[A-Za-z\d@$!%*?&#^~_+-]{12,}$/

// Employee Verification Schema (Step 1)
export const EmployeeVerificationSchema = z.object({
  staffNo: z.string().trim().min(3, "Staff number must be at least 3 characters").max(20, "Staff number must not exceed 20 characters").regex(/^[0-9A-Za-z_-]+$/, "Staff number contains invalid characters"),
  officialEmail: BaseSchemas.email,
})

// Registration Submission Schema (Step 4 Submit)
export const RegistrationSchema = z.object({
  staffNo: z.string().trim().min(3, "Staff number must be at least 3 characters").max(20, "Staff number must not exceed 20 characters").regex(/^[0-9A-Za-z_-]+$/, "Staff number contains invalid characters"),
  officialEmail: BaseSchemas.email,
  mobile: BaseSchemas.indianMobile,
  reportingTo: z.string().trim().max(20).optional().or(z.literal("")),
  requestedRole: z.enum(["employee", "manager", "transport"]).default("employee"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(STRONG_PASSWORD_12_PLUS, "Password must contain uppercase, lowercase, number, and special character"),
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the BHEL Transport & IT Security declaration" }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

// Validation utility functions
export class FormValidator {
  static validateField<T>(schema: z.ZodSchema<T>, value: unknown): { success: boolean; error?: string } {
    try {
      schema.parse(value)
      return { success: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, error: error.errors[0].message }
      }
      return { success: false, error: "Validation failed" }
    }
  }

  static validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; errors?: Record<string, string>; data?: T } {
    try {
      const validatedData = schema.parse(data)
      return { success: true, data: validatedData }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        error.errors.forEach((err) => {
          const path = err.path.join(".")
          errors[path] = err.message
        })
        return { success: false, errors }
      }
      return { success: false, errors: { general: "Validation failed" } }
    }
  }

  // Real-time validation for better UX
  static validateFieldRealTime<T>(
    schema: z.ZodSchema<T>, 
    value: unknown, 
    debounceMs: number = 300
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.validateField(schema, value))
      }, debounceMs)
    })
  }

  // Sanitize input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+=/gi, "") // Remove event handlers
      .trim()
  }

  // Check for common security patterns
  static isSecureInput(input: string): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /eval\(/i,
      /expression\(/i,
      /url\(/i,
      /import\(/i,
    ]
    
    return !dangerousPatterns.some(pattern => pattern.test(input))
  }
}

// Form state management types
export type FormErrors<T> = Partial<Record<keyof T, string>>
export type FormTouched<T> = Partial<Record<keyof T, boolean>>

export interface FormState<T> {
  values: T
  errors: FormErrors<T>
  touched: FormTouched<T>
  isSubmitting: boolean
  isValid: boolean
}

// Validation result types
export type ValidationResult<T> = {
  success: true
  data: T
} | {
  success: false
  errors: FormErrors<T>
}