import {
  PasswordResetError,
  resetPasswordWithToken,
  validatePasswordResetToken,
  writePasswordResetAudit,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordChangedEmail } from "@/lib/mail";
import { clearRefreshSession } from "@/lib/refresh-session";
import {
  consumeRateLimit,
  getClientIp,
  isSameOriginRequest,
  isStrongPassword,
} from "@/lib/security";

const resetSchema = z.object({
  token: z.string().trim().min(20).max(128),
  password: z
    .string()
    .min(10)
    .max(128)
    .refine(isStrongPassword, "Password must include upper, lower, number, and symbol"),
});

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`reset-password-validate:${ip}`, 30, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const valid = await validatePasswordResetToken(token);
  return NextResponse.json(
    { valid },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, { requireOrigin: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`reset-password:${ip}`, 10, 60 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 });
  }

  try {
    const result = await resetPasswordWithToken({
      rawToken: parsed.data.token,
      newPassword: parsed.data.password,
      ipAddress: ip,
    });

    try {
      await clearRefreshSession(result.userId);
    } catch {
      /* Redis may be unavailable in some local setups; password is already changed. */
    }

    const notified = await sendPasswordChangedEmail({
      to: result.email,
      name: result.name,
    });
    await writePasswordResetAudit({
      action: notified.ok ? "CHANGE_NOTIFICATION_SENT" : "CHANGE_NOTIFICATION_FAILED",
      email: result.email,
      userId: result.userId,
      ipAddress: ip,
      meta: notified.ok
        ? { kind: "password_changed", mode: notified.mode }
        : { kind: "password_changed", error: notified.error ?? "send_failed" },
    });

    return NextResponse.json(
      { ok: true, message: "Your password has been reset. You can sign in now." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PasswordResetError) {
      if (error.code === "SAME_PASSWORD") {
        return NextResponse.json(
          { error: "Choose a password different from your current one." },
          { status: 400 },
        );
      }
      if (error.code === "WEAK_PASSWORD") {
        return NextResponse.json({ error: "Password does not meet requirements." }, { status: 400 });
      }
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    }
    throw error;
  }
}
