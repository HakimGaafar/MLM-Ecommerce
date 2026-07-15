import { listVendorWalletLedger } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getVendorMarketId } from "@/lib/get-vendor-market";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const marketId = await getVendorMarketId(auth.vendorId);
  if (!marketId) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "payout" ? "payout" : "pay_in";
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);

  const result = await listVendorWalletLedger({
    ownerUserId: auth.userId,
    marketId,
    kind,
    page,
    pageSize,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
