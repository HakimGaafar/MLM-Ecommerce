import { prisma } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshTokenFromRequest,
  setAuthCookies,
  verifyRefreshToken,
} from "@/lib/auth";
import {
  clearRefreshSession,
  setActiveRefreshJti,
  verifyActiveRefreshJti,
} from "@/lib/refresh-session";
import { consumeRateLimit, getClientIp } from "@/lib/security";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`refresh:${ip}`, 30, 10 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const refreshToken = getRefreshTokenFromRequest(request);
  if (!refreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyRefreshToken(refreshToken).catch(() => null);
  if (!session?.sub || !session.jti) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jtiMatches = await verifyActiveRefreshJti(session.sub, session.jti);
  if (!jtiMatches) {
    await clearRefreshSession(session.sub);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user || user.status !== "ACTIVE") {
    await clearRefreshSession(session.sub);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.userRoles.map((item: (typeof user.userRoles)[number]) => item.role.code),
  };

  const newAccessToken = await createAccessToken(payload);
  const { token: newRefreshToken, jti: newJti } = await createRefreshToken(payload);
  await setActiveRefreshJti(payload.sub, newJti);

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  setAuthCookies(response, newAccessToken, newRefreshToken);
  return response;
}
