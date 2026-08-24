import { NextRequest, NextResponse } from "next/server";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { isPhoneOtpEnabled } from "@/lib/phone-otp";
import { consumeRateLimit, getClientIp } from "@/lib/security";

/** Status of optional phone OTP. Disabled unless PHONE_OTP_ENABLED=true. */
export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      enabled: isPhoneOtpEnabled(),
      phoneVerified: false,
      message: isPhoneOtpEnabled()
        ? "Phone verification is available for testing."
        : "Phone verification is temporarily disabled.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Send phone OTP — only when PHONE_OTP_ENABLED=true (console stub until SMS provider is wired). */
export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPhoneOtpEnabled()) {
    return NextResponse.json(
      { error: "Phone verification is temporarily disabled.", enabled: false },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`phone-otp-send:${session.sub}:${ip}`, 5, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const phone = body?.phone?.replace(/\D/g, "") ?? "";
  if (phone.length < 8) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  // Stub for testing: log a code instead of sending SMS until a provider is configured.
  const code = String(Math.floor(100000 + Math.random() * 900000));
  console.info(`[phone-otp:test] user=${session.sub} phone=${phone} code=${code}`);

  return NextResponse.json({
    enabled: true,
    sent: true,
    maskedPhone: `***${phone.slice(-4)}`,
    ...(process.env.NODE_ENV !== "production" ? { previewCode: code } : {}),
  });
}
