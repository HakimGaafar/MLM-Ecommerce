import { prisma } from "@mlm/db";
import { MerchantLoginSchema, normalizeMerchantUsername } from "@mlm/shared";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_ROLE_COOKIE, activeRoleCookieOptions } from "@/lib/active-role";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth";
import { setActiveRefreshJti } from "@/lib/refresh-session";
import { cacheTokenVersion } from "@/lib/session-invalidation";
import { consumeRateLimit, getClientIp } from "@/lib/security";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const ipThrottle = await consumeRateLimit(`merchant-login:${ip}`, 10, 10 * 60 * 1000);
  if (!ipThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${ipThrottle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = MerchantLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const username = normalizeMerchantUsername(parsed.data.username);
  const identityThrottle = await consumeRateLimit(
    `merchant-login:user:${username}`,
    8,
    10 * 60 * 1000,
  );
  if (!identityThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${identityThrottle.retryAfterSeconds}` } },
    );
  }

  const user = await prisma.user.findFirst({
    where: { username },
    include: { userRoles: { include: { role: true } } },
  });

  const roles = user?.userRoles.map((item) => item.role.code) ?? [];
  if (!user || user.status !== "ACTIVE" || !roles.includes("VENDOR")) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const payload = {
    sub: user.id,
    email: user.email,
    roles,
    tv: user.tokenVersion,
  };

  const accessToken = await createAccessToken(payload);
  const { token: refreshToken, jti } = await createRefreshToken(payload);
  await setActiveRefreshJti(payload.sub, jti);
  await cacheTokenVersion(user.id, user.tokenVersion);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  await setAuthCookies(response, accessToken, refreshToken);
  response.cookies.set(ACTIVE_ROLE_COOKIE, "VENDOR", activeRoleCookieOptions());

  return response;
}
