import {
  createPhoneVerificationOtp,
  getPhoneVerificationStatus,
  OtpVerificationError,
  verifyPhoneVerificationOtp,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { isPhoneOtpEnabled } from "@/lib/phone-otp";
import { consumeRateLimit, getClientIp } from "@/lib/security";
import { publicErrorPayload } from "@/lib/api-error-response";

function otpErrorResponse(error: OtpVerificationError) {
  const status =
    error.code === "RATE_LIMITED"
      ? 429
      : error.code === "ALREADY_VERIFIED"
        ? 409
        : 400;
  return NextResponse.json(
    publicErrorPayload(error, { context: "auth/phone-verification", code: error.code }),
    { status },
  );
}

export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getPhoneVerificationStatus(session.sub);
    return NextResponse.json(
      {
        enabled: isPhoneOtpEnabled(),
        ...status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof OtpVerificationError) return otpErrorResponse(error);
    throw error;
  }
}

const SendSchema = z.object({
  phone: z.string().trim().min(8).max(24),
});

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

  const body = await request.json().catch(() => null);
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  try {
    const issued = await createPhoneVerificationOtp(session.sub, parsed.data.phone);
    console.info(
      `[phone-otp:test] user=${session.sub} phone=${parsed.data.phone} code=${issued.code}`,
    );
    return NextResponse.json({
      enabled: true,
      sent: true,
      maskedPhone: issued.maskedPhone,
      ...(process.env.NODE_ENV !== "production" ? { previewCode: issued.code } : {}),
    });
  } catch (error) {
    if (error instanceof OtpVerificationError) return otpErrorResponse(error);
    throw error;
  }
}

const VerifySchema = z.object({
  code: z.string().min(4).max(12),
});

export async function PUT(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  try {
    await verifyPhoneVerificationOtp(session.sub, parsed.data.code);
    return NextResponse.json({ phoneVerified: true });
  } catch (error) {
    if (error instanceof OtpVerificationError) return otpErrorResponse(error);
    throw error;
  }
}
