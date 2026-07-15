import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GUEST_LOCALE_COOKIE } from "@/lib/ui-locale";

const BodySchema = z.object({
  locale: z.enum(["en", "ar"]),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}
