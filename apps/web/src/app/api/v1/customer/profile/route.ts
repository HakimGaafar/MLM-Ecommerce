import { getCustomerProfile, updateCustomerProfile } from "@mlm/domain";
import { CustomerProfileUpdateSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { GUEST_LOCALE_COOKIE } from "@/lib/ui-locale";
import { requireCustomerSession } from "@/lib/require-customer-session";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await getCustomerProfile(auth.userId);
  if (!profile) {
    return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = CustomerProfileUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateCustomerProfile(auth.userId, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
  }

  const response = NextResponse.json(updated, {
    headers: { "Cache-Control": "no-store" },
  });

  if (parsed.data.preferredLanguage) {
    response.cookies.set(GUEST_LOCALE_COOKIE, parsed.data.preferredLanguage, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return response;
}
