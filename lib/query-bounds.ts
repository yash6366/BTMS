/**
 * Resource Bounding & Input Sanitization
 * Enforces strict limits on database pagination, search terms, and query parameters.
 */

export interface BoundedPagination {
  page: number
  pageSize: number
  offset: number
}

/**
 * Standardized pagination validation:
 * - page >= 1
 * - 5 <= pageSize <= 100
 * - Deterministic fallback for NaN, Infinity, and malformed strings
 */
export function parseBoundedPagination(
  rawPage?: string | number | null,
  rawPageSize?: string | number | null,
  defaultPageSize = 25
): BoundedPagination {
  let page = typeof rawPage === "number" ? rawPage : parseInt(String(rawPage || "1"), 10)
  if (isNaN(page) || !isFinite(page) || page < 1) {
    page = 1
  }

  let pageSize =
    typeof rawPageSize === "number"
      ? rawPageSize
      : parseInt(String(rawPageSize || defaultPageSize), 10)
  if (isNaN(pageSize) || !isFinite(pageSize)) {
    pageSize = defaultPageSize
  }

  // Hard clamp bounds: min 5, max 100
  pageSize = Math.min(100, Math.max(5, pageSize))

  const offset = (page - 1) * pageSize

  return {
    page,
    pageSize,
    offset,
  }
}

/**
 * Strips non-printable control characters, trims whitespace, and clamps to maximum 100 characters.
 */
export function sanitizeSearchQuery(term?: string | null, maxLength = 100): string {
  if (!term || typeof term !== "string") {
    return ""
  }

  // Remove control characters (ASCII 0-31 and 127)
  const sanitized = term.replace(/[\x00-\x1F\x7F]/g, "").trim()

  return sanitized.slice(0, maxLength)
}
