import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getRefreshTokenFromRequest, verifyRefreshToken } from "@/lib/auth";
import { clearRefreshSession } from "@/lib/refresh-session";

export async function POST(request: NextRequest) {
  const refreshToken = getRefreshTokenFromRequest(request);
  if (refreshToken) {
    const session = await verifyRefreshToken(refreshToken).catch(() => null);
    if (session?.sub) {
      await clearRefreshSession(session.sub);
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);

  return response;
}
