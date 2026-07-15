import { getQueueRedis } from "@mlm/queue";
import type { NextRequest } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function sanitizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

export function isStrongPassword(value: string) {
  if (value.length < 10 || value.length > 128) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return /[^A-Za-z0-9]/.test(value);
}

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function isSameOriginRequest(
  request: NextRequest,
  options: { requireOrigin?: boolean } = {},
): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) {
    return options.requireOrigin !== true || fetchSite === "same-origin";
  }

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
    return new URL(origin).host.toLowerCase() === expectedHost.toLowerCase();
  } catch {
    return false;
  }
}

function consumeInMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Redis-backed sliding window; in production fails closed when Redis is unavailable. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  try {
    const redis = getQueueRedis();
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    if (count > limit) {
      const ttlMs = await redis.pttl(redisKey);
      const retryAfterSeconds = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    const failClosed =
      process.env.NODE_ENV === "production" && process.env.RATE_LIMIT_FAIL_CLOSED !== "false";
    if (failClosed) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    return consumeInMemoryRateLimit(key, limit, windowMs);
  }
}
