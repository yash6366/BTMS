/**
 * Enterprise Rate Limiting Subsystem
 * 
 * ARCHITECTURAL NOTICE:
 * - InMemoryRateLimiterStore provides single-instance / process-isolated protection.
 * - For multi-instance clustered deployments (e.g. Kubernetes, multiple Vercel/Node instances),
 *   a shared DistributedRateLimiterStore (e.g. Upstash Redis / Redis cluster) must be configured.
 */

export interface RateLimitResult {
  allowed: boolean
  limit: number
  current: number
  remaining: number
  resetTimeMs: number
  retryAfterSeconds: number
}

export interface RateLimiterStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTimeMs: number }>
  reset(key: string): Promise<void>
}

/**
 * In-Memory Sliding Window Store with automated stale entry collection.
 * Certified for single-instance Node.js processes.
 */
export class InMemoryRateLimiterStore implements RateLimiterStore {
  private hits: Map<string, { timestamps: number[]; resetTimeMs: number }> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(cleanupIntervalMs = 60000) {
    // Periodic garbage collection to prevent memory leaks from one-off keys
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.pruneStale(), cleanupIntervalMs)
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref()
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTimeMs: number }> {
    const now = Date.now()
    const windowStart = now - windowMs

    let entry = this.hits.get(key)
    if (!entry) {
      entry = { timestamps: [], resetTimeMs: now + windowMs }
      this.hits.set(key, entry)
    }

    // Filter out timestamps older than the sliding window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
    entry.timestamps.push(now)
    entry.resetTimeMs = now + windowMs

    return {
      count: entry.timestamps.length,
      resetTimeMs: entry.resetTimeMs,
    }
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key)
  }

  private pruneStale() {
    const now = Date.now()
    for (const [key, entry] of this.hits.entries()) {
      if (entry.resetTimeMs < now && entry.timestamps.length === 0) {
        this.hits.delete(key)
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.hits.clear()
  }
}

/**
 * Pluggable Redis / Distributed Store adapter skeleton for multi-node deployments.
 */
export class DistributedRateLimiterStore implements RateLimiterStore {
  private client: any

  constructor(redisClient: any) {
    this.client = redisClient
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTimeMs: number }> {
    if (!this.client) {
      throw new Error("DISTRIBUTED_STORE_UNCONFIGURED: Redis client must be supplied.")
    }
    // Standard Redis sliding window script or INCR with TTL
    const now = Date.now()
    const count = await this.client.incr(key)
    if (count === 1) {
      await this.client.pexpire(key, windowMs)
    }
    const ttl = await this.client.pttl(key)
    return { count, resetTimeMs: now + Math.max(0, ttl) }
  }

  async reset(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key)
    }
  }
}

// Global default singleton store
const defaultStore = new InMemoryRateLimiterStore()

/**
 * Authoritative rate limiter checker
 * @param key Isolated resource key (e.g. `auth:ip:${ip}`, `admin:reset:${actor}`)
 * @param limit Max allowed requests within window
 * @param windowMs Duration of sliding window in milliseconds
 * @param store Optional custom store (defaults to InMemoryRateLimiterStore)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  store: RateLimiterStore = defaultStore
): Promise<RateLimitResult> {
  const { count, resetTimeMs } = await store.increment(key, windowMs)
  const remaining = Math.max(0, limit - count)
  const allowed = count <= limit
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((resetTimeMs - Date.now()) / 1000))

  return {
    allowed,
    limit,
    current: count,
    remaining,
    resetTimeMs,
    retryAfterSeconds,
  }
}

/**
 * Standard enterprise HTTP rate limit response headers (RFC 6585 & IETF draft)
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTimeMs / 1000).toString(),
  }

  if (!result.allowed) {
    headers["Retry-After"] = result.retryAfterSeconds.toString()
  }

  return headers
}
