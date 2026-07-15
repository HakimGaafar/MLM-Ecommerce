import { listVendorOrders } from "@mlm/domain";
import { VendorOrderListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";
import { resolveRequestMarket } from "@/lib/request-market";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:orders:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = VendorOrderListQuerySchema.safeParse({
    tab: url.searchParams.get("tab") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const query = parsed.success
    ? parsed.data
    : { tab: "all" as const, page: 1, pageSize: 5, q: undefined };

  const market = await resolveRequestMarket();
  const result = await listVendorOrders({
    vendorId: auth.vendorId,
    marketId: market.id,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 5,
    tab: query.tab,
    q: query.q,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
