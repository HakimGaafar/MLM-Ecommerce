import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAddressCountryCode } from "@mlm/shared";
import {
  GUEST_DELIVERY_COOKIE,
  GUEST_DELIVERY_MAX_AGE_SECONDS,
  serializeGuestDeliveryCookie,
} from "@/lib/guest-delivery-cookie";
import { consumeRateLimit, getClientIp } from "@/lib/security";

const BodySchema = z.object({
  countryCode: z.string().trim().toUpperCase().length(2),
  city: z.string().trim().min(2).max(120),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`guest-delivery:${ip}`, 20, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid delivery city." }, { status: 400 });
  }

  const countryCode = parsed.data.countryCode;
  if (!isAddressCountryCode(countryCode)) {
    return NextResponse.json({ error: "Unsupported country for guest delivery." }, { status: 400 });
  }

  const value = serializeGuestDeliveryCookie({
    countryCode,
    city: parsed.data.city,
  });

  const response = NextResponse.json({
    countryCode,
    city: parsed.data.city.trim().replace(/\s+/g, " "),
  });
  response.cookies.set(GUEST_DELIVERY_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_DELIVERY_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ cleared: true });
  response.cookies.set(GUEST_DELIVERY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
