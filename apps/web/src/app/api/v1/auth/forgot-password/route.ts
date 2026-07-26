import {
  createPasswordResetRequest,
  writePasswordResetAudit,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  consumeRateLimit,
  getClientIp,
  isSameOriginRequest,
  normalizeEmail,
} from "@/lib/security";

const schema = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.email()),
});

const GENERIC_OK = {
  ok: true as const,
  message:
    "If an account exists for that email, we have sent a password reset link.",
};

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, { requireOrigin: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request);
  const ipThrottle = await consumeRateLimit(`forgot-password:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!ipThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${ipThrottle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Same shape as success to avoid email enumeration via validation differences for empty body;
    // invalid format still returns 400 so the UI can show field errors.
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { email } = parsed.data;
  const emailThrottle = await consumeRateLimit(
    `forgot-password:email:${email}`,
    3,
    60 * 60 * 1000,
  );
  if (!emailThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${emailThrottle.retryAfterSeconds}` } },
    );
  }

  const result = await createPasswordResetRequest({ email, ipAddress: ip });

  if (result.rawToken && result.userId) {
    const sent = await sendPasswordResetEmail({
      to: result.email,
      name: result.userName ?? "there",
      rawToken: result.rawToken,
    });
    if (!sent.ok) {
      await writePasswordResetAudit({
        action: "CHANGE_NOTIFICATION_FAILED",
        email: result.email,
        userId: result.userId,
        ipAddress: ip,
        meta: { kind: "reset_email", error: sent.error ?? "send_failed" },
      });
    }
  }

  return NextResponse.json(GENERIC_OK, {
    headers: { "Cache-Control": "no-store" },
  });
}
