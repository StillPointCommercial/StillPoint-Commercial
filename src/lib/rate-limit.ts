// Simple in-memory rate limiter
// Note: This resets on server restart and is per-instance only.
// For production at scale, use Redis-based rate limiting.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  userId: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count }
}
