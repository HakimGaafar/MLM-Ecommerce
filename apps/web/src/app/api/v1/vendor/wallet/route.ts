import { getVendorWalletSummary } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getVendorMarketId } from "@/lib/get-vendor-market";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const marketId = await getVendorMarketId(auth.vendorId);
  if (!marketId) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const summary = await getVendorWalletSummary(auth.userId, marketId);
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
