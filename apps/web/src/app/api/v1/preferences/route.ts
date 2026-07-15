import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role";
import { THEME_COOKIE, type ThemePreference } from "@/lib/theme-preference";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  activeRole: z.enum(["ADMIN", "VENDOR", "CUSTOMER"]).optional(),
});

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null);
  const parsed = PreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  const opts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };

  if (parsed.data.theme) {
    res.cookies.set(THEME_COOKIE, parsed.data.theme as ThemePreference, opts);
  }
  if (parsed.data.activeRole) {
    res.cookies.set(ACTIVE_ROLE_COOKIE, parsed.data.activeRole, opts);
  }

  return res;
}
