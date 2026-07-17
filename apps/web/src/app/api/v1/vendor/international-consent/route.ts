import { acceptInternationalSalesAgreement } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { isSameOriginRequest } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!auth.isOwner) {
    return NextResponse.json({ error: "Only the store owner can accept this agreement." }, { status: 403 });
  }

  await acceptInternationalSalesAgreement(auth.vendorId);
  return NextResponse.json({ accepted: true });
}
