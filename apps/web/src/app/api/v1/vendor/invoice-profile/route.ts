import {
  getVendorInvoiceProfile,
  OrderInvoiceError,
  updateVendorInvoiceProfile,
} from "@mlm/domain";
import { VendorInvoiceProfileSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await getVendorInvoiceProfile(auth.vendorId);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = VendorInvoiceProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await updateVendorInvoiceProfile(auth.vendorId, parsed.data);
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrderInvoiceError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
