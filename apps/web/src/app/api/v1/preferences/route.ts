import {
  ACTIVE_ROLE_COOKIE,
  activeRoleCookieOptions,
  getRolesUserCanSwitch,
} from "@/lib/active-role";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme-preference";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  activeRole: z.enum(["ADMIN", "VENDOR", "CUSTOMER"]).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, { requireOrigin: true })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = PreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const token = getAccessTokenFromRequest(request);
  const session = token ? await verifyAccessToken(token).catch(() => null) : null;

  if (parsed.data.activeRole) {
    if (!session?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const allowed = getRolesUserCanSwitch(session.roles ?? []);
    if (!allowed.includes(parsed.data.activeRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true });
  const opts = activeRoleCookieOptions();

  if (parsed.data.theme) {
    res.cookies.set(THEME_COOKIE, parsed.data.theme as ThemePreference, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  if (parsed.data.activeRole) {
    res.cookies.set(ACTIVE_ROLE_COOKIE, parsed.data.activeRole, opts);
  }

  return res;
}
