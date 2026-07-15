import { submitVendorProductForReview, VendorShippingError } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function POST(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:edit");
  if (denied) return denied;

  const { id } = await context.params;
  try {
    const product = await submitVendorProductForReview(auth.vendorId, id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof VendorShippingError && e.code === "PROFILE_NOT_APPROVED") {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    if (e instanceof Error && e.message === "INVALID_STATUS_TRANSITION") {
      return NextResponse.json({ error: "Cannot submit this product for review" }, { status: 400 });
    }
    throw e;
  }
}
