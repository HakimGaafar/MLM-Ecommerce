import { prisma } from "@mlm/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth";
import { setActiveRefreshJti } from "@/lib/refresh-session";
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
  const throttle = await consumeRateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const { email, password } = parsed.data;
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
  };

  const accessToken = await createAccessToken(payload);
  const { token: refreshToken, jti } = await createRefreshToken(payload);
  await setActiveRefreshJti(payload.sub, jti);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  setAuthCookies(response, accessToken, refreshToken);

  const primaryRole = resolvePrimaryRole(roles);
  if (primaryRole) {
    response.cookies.set(ACTIVE_ROLE_COOKIE, primaryRole, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
