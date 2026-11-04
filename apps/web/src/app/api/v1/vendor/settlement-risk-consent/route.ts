import { prisma } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { resolveRequestMarket } from "@/lib/request-market";

/** Records vendor acceptance of FX / transfer / customs risk (listing consent). */
export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const market = await resolveRequestMarket();
  const vendor = await prisma.vendor.findFirst({
    where: {
      ownerUserId: auth.userId,
      OR: [{ marketId: market.id }, { primaryMarketId: market.id }],
    },
    select: { id: true },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { settlementRiskConsentAt: new Date() },
  });

  return NextResponse.json({ ok: true, consentedAt: new Date().toISOString() });
}
