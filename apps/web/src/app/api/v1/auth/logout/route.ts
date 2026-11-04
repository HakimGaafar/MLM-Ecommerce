import { NextRequest, NextResponse } from "next/server";
import { clearActiveRoleCookie } from "@/lib/active-role";
import {
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { invalidateUserSessions } from "@/lib/session-invalidation";

export async function POST(request: NextRequest) {
  let userId: string | null = null;

  const refreshToken = getRefreshTokenFromRequest(request);
  if (refreshToken) {
    const session = await verifyRefreshToken(refreshToken).catch(() => null);
    if (session?.sub) userId = session.sub;
  }

  // If refresh cookie is missing/invalid, still revoke via access token subject.
  if (!userId) {
    const accessToken = getAccessTokenFromRequest(request);
    if (accessToken) {
      const session = await verifyAccessToken(accessToken).catch(() => null);
      if (session?.sub) userId = session.sub;
    }
  }

  if (userId) {
    try {
      await invalidateUserSessions(userId);
    } catch {
      /* Best-effort — still clear cookies below. */
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  clearActiveRoleCookie(response);
  return response;
}
