import { getVendorAnalytics, getVendorDashboardSnapshot } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:dashboard:read");
  if (denied) return denied;

  const [analytics, snapshot] = await Promise.all([
    getVendorAnalytics(auth.vendorId),
    getVendorDashboardSnapshot(auth.vendorId),
  ]);
  return NextResponse.json({ analytics, snapshot }, { headers: { "Cache-Control": "no-store" } });
}
