import { getMerchantReadiness } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const readiness = await getMerchantReadiness(auth.vendorId);
  if (!readiness) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ readiness }, { headers: { "Cache-Control": "no-store" } });
}
