import { MarketOfferApprovalError, reviewMarketOffer } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { publicErrorPayload } from "@/lib/api-error-response";
import { z } from "zod";

const BodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ offerId: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { offerId } = await context.params;
  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const offer = await reviewMarketOffer(offerId, parsed.data.action, {
      reviewedByUserId: auth.userId,
      rejectionReason: parsed.data.rejectionReason,
    });
    return NextResponse.json({ offer }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof MarketOfferApprovalError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "PRODUCT_NOT_PUBLISHED" ? 409 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), {
        status,
      });
    }
    throw e;
  }
}
