import { getVendorFulfillmentMetrics } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const metrics = await getVendorFulfillmentMetrics(id);
  if (!metrics) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ metrics }, { headers: { "Cache-Control": "no-store" } });
}
