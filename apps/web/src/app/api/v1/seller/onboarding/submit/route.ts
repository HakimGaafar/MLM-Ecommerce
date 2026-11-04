import { SellerOnboardError, submitVendorOnboardingForReview } from "@mlm/domain";
import { VendorOnboardingSubmitReviewSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId || !auth.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = VendorOnboardingSubmitReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await submitVendorOnboardingForReview({
      vendorId: auth.vendorId,
      ownerUserId: auth.userId,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
