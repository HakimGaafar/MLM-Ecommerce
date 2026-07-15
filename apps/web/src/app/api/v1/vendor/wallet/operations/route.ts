import { listVendorOperationsLedger } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getVendorMarketId } from "@/lib/get-vendor-market";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireVendorPermission } from "@/lib/require-vendor-permission";
import { requireVendorSession } from "@/lib/require-vendor-session";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:wallet:read");
  if (denied) return denied;

  const marketId = await getVendorMarketId(auth.vendorId);
  if (!marketId) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const url = new URL(request.url);
  const direction = url.searchParams.get("direction") ?? "all";
  const status = url.searchParams.get("status") ?? "all";
  const dateRange = url.searchParams.get("dateRange") ?? "all";
  const dateFrom = url.searchParams.get("dateFrom") ?? "";
  const dateTo = url.searchParams.get("dateTo") ?? "";
  const { page, pageSize } = parsePaginationSearchParams(url.searchParams);

  const result = await listVendorOperationsLedger({
    ownerUserId: auth.userId,
    marketId,
    directionFilter: direction,
    statusFilter: status,
    dateRange,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      ...result,
      filters: {
        direction,
        status,
        dateRange,
        dateFrom,
        dateTo,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
