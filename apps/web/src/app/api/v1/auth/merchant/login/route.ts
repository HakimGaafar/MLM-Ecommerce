import { prisma } from "@mlm/db";
import { MerchantLoginSchema, normalizeMerchantUsername } from "@mlm/shared";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth";
import { setActiveRefreshJti } from "@/lib/refresh-session";
import { consumeRateLimit, getClientIp } from "@/lib/security";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`merchant-login:${ip}`, 10, 10 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = MerchantLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const username = normalizeMerchantUsername(parsed.data.username);
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
  };

  const accessToken = await createAccessToken(payload);
  const { token: refreshToken, jti } = await createRefreshToken(payload);
  await setActiveRefreshJti(payload.sub, jti);

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  setAuthCookies(response, accessToken, refreshToken);
  response.cookies.set(ACTIVE_ROLE_COOKIE, "VENDOR", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
