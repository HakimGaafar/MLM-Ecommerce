import { prisma } from "@mlm/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVE_ROLE_COOKIE, activeRoleCookieOptions } from "@/lib/active-role";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth";
import { setActiveRefreshJti } from "@/lib/refresh-session";
import { cacheTokenVersion } from "@/lib/session-invalidation";
import { resolvePrimaryRole } from "@/lib/server-session";
import {
  consumeRateLimit,
  getClientIp,
  normalizeEmail,
} from "@/lib/security";

const loginSchema = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.email()),
  // Login only checks the stored hash; register/reset keep strong password rules.
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const ipThrottle = await consumeRateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
  if (!ipThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${ipThrottle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const { email, password } = parsed.data;
  const identityThrottle = await consumeRateLimit(`login:email:${email}`, 8, 10 * 60 * 1000);
  if (!identityThrottle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${identityThrottle.retryAfterSeconds}` } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const roles = user.userRoles.map((item: (typeof user.userRoles)[number]) => item.role.code);
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

  // Customer email login prefers CUSTOMER when the user has that role (Phase 3).
  // Merchant login sets VENDOR separately.
  const landingRole = roles.includes("CUSTOMER")
    ? "CUSTOMER"
    : resolvePrimaryRole(roles);
  if (landingRole) {
    response.cookies.set(ACTIVE_ROLE_COOKIE, landingRole, activeRoleCookieOptions());
  }

  return response;
}
