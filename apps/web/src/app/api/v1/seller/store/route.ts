import { createStoreForExistingUser, SellerOnboardError } from "@mlm/domain";
import { SellerStoreFieldsSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = SellerStoreFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const market = await resolveRequestMarket();
    if (market.code === "GLOBAL" && parsed.data.internationalSalesConsent !== true) {
      return NextResponse.json(
        { error: "International sales agreement is required for the global marketplace." },
        { status: 400 },
      );
    }
    const result = await createStoreForExistingUser(session.sub, parsed.data, market.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      const status = e.code === "ALREADY_VENDOR" || e.code === "SLUG_TAKEN" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
