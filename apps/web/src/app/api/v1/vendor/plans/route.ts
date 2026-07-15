import { getVendorPlansAndBills } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:dashboard:read");
  if (denied) return denied;

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const data = await getVendorPlansAndBills(auth.vendorId, { page, pageSize });
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
