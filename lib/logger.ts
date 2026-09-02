import { NextResponse } from "next/server"
import crypto from "crypto"

/**
 * Validates untrusted correlation ID from incoming HTTP headers.
 * Protects against buffer bloat and log injection.
 * Format: alphanumeric, dashes, and underscores only, max 64 characters.
 */
export function getOrGenerateCorrelationId(headerValue?: string | null): string {
  if (headerValue && typeof headerValue === "string") {
    const trimmed = headerValue.trim()
    const isValidFormat = /^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)
    if (isValidFormat) {
      return trimmed
    }
  }
  return crypto.randomUUID()
}

/**
 * Redacts sensitive credentials, tokens, and database connection strings from strings/objects
 */
export function maskSensitiveData(input: any): any {
  if (!input) return input

  if (typeof input === "string") {
    return input
      .replace(/postgres(?:ql)?:\/\/[^@]+@[^/]+/gi, "postgresql://[REDACTED_CREDENTIALS]@[HOST]")
      .replace(/(?:password|pwd|secret|token)["']?\s*[:=]\s*["']?([^"',\s]+)/gi, '$1=[REDACTED]')
  }

  if (typeof input === "object") {
    const masked: Record<string, any> = Array.isArray(input) ? [] : {}
    for (const [k, v] of Object.entries(input)) {
      const lowerKey = k.toLowerCase()
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("hash")
      ) {
        masked[k] = "[REDACTED]"
      } else if (typeof v === "object" && v !== null) {
        masked[k] = maskSensitiveData(v)
      } else if (typeof v === "string") {
        masked[k] = maskSensitiveData(v)
      } else {
        masked[k] = v
      }
    }
    return masked
  }

  return input
}

export type LogLevel = "info" | "warn" | "error"

/**
 * Structured Enterprise JSON Logger
 */
export const logger = {
  info(message: string, meta: Record<string, any> = {}) {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        ...maskSensitiveData(meta),
      })
    )
  },

  warn(message: string, meta: Record<string, any> = {}) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        timestamp: new Date().toISOString(),
        message,
        ...maskSensitiveData(meta),
      })
    )
  },

  error(message: string, error?: any, meta: Record<string, any> = {}) {
    const errorDetails = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          // Retain stack trace in server-side logs only (masked for sensitive secrets)
          stack: maskSensitiveData(error.stack),
        }
      : { raw: error }

    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        error: errorDetails,
        ...maskSensitiveData(meta),
      })
    )
  },
}

/**
 * Known safe business error codes that can be displayed to clients.
 */
const SAFE_CLIENT_ERROR_CODES = new Set([
  "CANNOT_DEACTIVATE_SELF",
  "CANNOT_DEMOTE_SELF",
  "CANNOT_REMOVE_LAST_ADMIN",
  "USER_NOT_FOUND",
  "INVALID_ROLE",
  "REASON_REQUIRED",
  "REQUISITION_NOT_FOUND",
  "ACCOUNT_ALREADY_EXISTS",
  "EMPLOYEE_NOT_IN_MASTER",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "TOO_MANY_REQUESTS",
])

/**
 * Authoritative Error Response Sanitization
 * Never exposes SQL syntax, connection strings, table details, or stack traces to clients.
 */
export function createSafeErrorResponse(
  err: any,
  correlationId: string,
  statusCode = 500
): NextResponse {
  // Log full diagnostic context on the server side
  logger.error("API request failed", err, { correlationId, statusCode })

  let clientMessage = "Internal server error"
  let responseStatus = statusCode

  if (err instanceof Error) {
    const rawMsg = err.message || ""
    // Check if the error begins with a known domain invariant code
    for (const safeCode of SAFE_CLIENT_ERROR_CODES) {
      if (rawMsg.includes(safeCode)) {
        clientMessage = rawMsg
        if (responseStatus === 500) {
          responseStatus = 400
        }
        break
      }
    }
  }

  const response = NextResponse.json(
    {
      success: false,
      error: clientMessage,
      correlationId,
    },
    { status: responseStatus }
  )

  response.headers.set("X-Correlation-ID", correlationId)
  return response
}
