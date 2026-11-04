import { SellerOnboardError, submitVendorProfileChangeRequest } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { z } from "zod";

const BodySchema = z.object({
  proposed: z.record(z.string(), z.unknown()),
  vendorNote: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized || !auth.vendorId || !auth.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const changeRequest = await submitVendorProfileChangeRequest({
      vendorId: auth.vendorId,
      ownerUserId: auth.userId,
      proposed: parsed.data.proposed,
      vendorNote: parsed.data.vendorNote,
    });
    return NextResponse.json({ changeRequest }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
