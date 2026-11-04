import { getVendorOnboardingState, listOnboardingFieldReviews } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { resolveRequestMarket } from "@/lib/request-market";
import { prisma } from "@mlm/db";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const market = await resolveRequestMarket();
  const state = await getVendorOnboardingState(auth.userId, market.id);
  if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, name: true },
  });
  const fieldReviews = await listOnboardingFieldReviews(state.id);

  return NextResponse.json(
    {
      vendor: state,
      ownerEmail: owner?.email ?? null,
      ownerName: owner?.name ?? null,
      fieldReviews,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
