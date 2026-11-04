import { SellerOnboardError, startVendorOnboardingForExistingUser } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";
import { ACTIVE_ROLE_COOKIE, activeRoleCookieOptions } from "@/lib/active-role";

const BodySchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(32),
  repNameEn: z.string().trim().min(2).max(120),
  repNameOther: z.string().trim().max(120).optional().or(z.literal("")),
  shortBusinessNote: z.string().trim().max(500).optional().or(z.literal("")),
  acceptCommissionTerms: z.literal(true),
});

export async function POST(request: NextRequest) {
  const token = getAccessTokenFromRequest(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyAccessToken(token).catch(() => null);
  if (!session?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const market = await resolveRequestMarket();
    const result = await startVendorOnboardingForExistingUser({
      userId: session.sub,
      marketId: market.id,
      storeName: parsed.data.storeName,
      phone: parsed.data.phone,
      repNameEn: parsed.data.repNameEn,
      repNameOther: parsed.data.repNameOther || undefined,
      shortBusinessNote: parsed.data.shortBusinessNote || undefined,
      acceptCommissionTerms: true,
    });
    const response = NextResponse.json(
      { ...result, onboardingStatus: "UNDER_REGISTRATION", onboardingStep: 2 },
      { status: 201 },
    );
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(ACTIVE_ROLE_COOKIE, "VENDOR", activeRoleCookieOptions());
    return response;
  } catch (e) {
    if (e instanceof SellerOnboardError) {
      const status = e.code === "ALREADY_VENDOR" || e.code === "SLUG_TAKEN" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
