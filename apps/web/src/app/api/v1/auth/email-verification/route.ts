import {
  createAccountVerificationOtp,
  getEmailVerificationStatus,
  OtpVerificationError,
  verifyAccountVerificationOtp,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTokenFromRequest, verifySessionToken } from "@/lib/auth";
import { sendOtpVerificationEmail } from "@/lib/mail";
import { consumeRateLimit, getClientIp } from "@/lib/security";
import { publicErrorMessage, publicErrorPayload, PUBLIC_API_ERRORS } from "@/lib/api-error-response";

function otpErrorResponse(error: OtpVerificationError) {
  const status =
    error.code === "RATE_LIMITED"
      ? 429
      : error.code === "ALREADY_VERIFIED"
        ? 409
        : 400;
  return NextResponse.json(
    publicErrorPayload(error, { context: "auth/email-verification", code: error.code }),
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
    const status = await getEmailVerificationStatus(session.sub);
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OtpVerificationError) return otpErrorResponse(error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySessionToken(token).catch(() => null);
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`otp-send:${session.sub}:${ip}`, 8, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  try {
    const issued = await createAccountVerificationOtp(session.sub);
    const mail = await sendOtpVerificationEmail({
      to: issued.email,
      name: issued.email.split("@")[0] ?? "there",
      code: issued.code,
    });
    if (!mail.ok) {
      return NextResponse.json({ error: "Could not send verification code." }, { status: 503 });
    }
    return NextResponse.json({
      maskedEmail: issued.maskedEmail,
      sent: true,
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

  const body = await request.json().catch(() => null);
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  try {
    await verifyAccountVerificationOtp(session.sub, parsed.data.code);
    return NextResponse.json({ emailVerified: true });
  } catch (error) {
    if (error instanceof OtpVerificationError) return otpErrorResponse(error);
    throw error;
  }
}
