import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { consumeRateLimit, getClientIp } from "@/lib/security";

export async function enforceRateLimit(
  request: NextRequest,
  key: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const throttle = await consumeRateLimit(key, limit, windowMs);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": `${throttle.retryAfterSeconds}` },
      },
    );
  }
  return null;
}

export async function enforceUserRateLimit(
  request: NextRequest,
  userId: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  return enforceRateLimit(request, `${action}:user:${userId}`, limit, windowMs);
}

export async function enforceIpRateLimit(
  request: NextRequest,
  action: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  return enforceRateLimit(request, `${action}:ip:${ip}`, limit, windowMs);
}
