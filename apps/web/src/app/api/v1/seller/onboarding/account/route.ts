import {
  startVendorOnboardingAccount,
  TurnstileError,
  ReferralBindError,
  SellerOnboardError,
} from "@mlm/domain";
import { VendorOnboardingAccountSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_ROLE_COOKIE, activeRoleCookieOptions } from "@/lib/active-role";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth";
import { setActiveRefreshJti } from "@/lib/refresh-session";
import { cacheTokenVersion } from "@/lib/session-invalidation";
import { resolveRequestMarket } from "@/lib/request-market";
import { consumeRateLimit, getClientIp, isStrongPassword } from "@/lib/security";
import { publicErrorPayload } from "@/lib/api-error-response";
import { prisma } from "@mlm/db";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`seller-onboarding-account:${ip}`, 6, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = VendorOnboardingAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!isStrongPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "Password must include upper, lower, number, and symbol" },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const result = await startVendorOnboardingAccount({
      input: parsed.data,
      marketId: market.id,
      remoteIp: ip,
      userAgent: request.headers.get("user-agent"),
    });

    const [roleRows, userRow] = await Promise.all([
      prisma.userRole.findMany({
        where: { userId: result.userId },
        select: { role: { select: { code: true } } },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: result.userId },
        select: { tokenVersion: true },
      }),
    ]);
    const roles = roleRows.map((r) => r.role.code);
    const payload = {
      sub: result.userId,
      email: result.email,
      roles,
      tv: userRow.tokenVersion,
    };
    const accessToken = await createAccessToken(payload);
    const { token: refreshToken, jti } = await createRefreshToken(payload);
    await setActiveRefreshJti(payload.sub, jti);
    await cacheTokenVersion(result.userId, userRow.tokenVersion);

    const response = NextResponse.json(
      { ...result, onboardingStatus: "UNDER_REGISTRATION", onboardingStep: 2 },
      { status: 201 },
    );
    response.headers.set("Cache-Control", "no-store");
    await setAuthCookies(response, accessToken, refreshToken);
    response.cookies.set(ACTIVE_ROLE_COOKIE, "VENDOR", activeRoleCookieOptions());
    return response;
  } catch (e) {
    if (e instanceof TurnstileError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    if (e instanceof ReferralBindError) {
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status: 400 });
    }
    if (e instanceof SellerOnboardError) {
      const status =
        e.code === "EMAIL_IN_USE" ||
        e.code === "CUSTOMER_EMAIL_EXISTS" ||
        e.code === "SLUG_TAKEN" ||
        e.code === "USERNAME_IN_USE"
          ? 409
          : e.code === "SLUG_RESERVED"
            ? 400
            : 400;
      return NextResponse.json(
        { error: publicErrorPayload(e, { context: "api", code: e.code }).error, code: e.code },
        { status },
      );
    }
    throw e;
  }
}
