import { SellerOnboardError, startVendorOnboardingForExistingUser } from "@mlm/domain";
import { LEGAL_DOCUMENT_TYPES, MERCHANT_REGISTRATION_DOCUMENT_TYPES } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessTokenFromRequest, verifyAccessToken } from "@/lib/auth";
import { resolveRequestMarket } from "@/lib/request-market";
import { ACTIVE_ROLE_COOKIE, activeRoleCookieOptions } from "@/lib/active-role";
import { getClientIp } from "@/lib/security";

const BodySchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(32),
  repNameEn: z.string().trim().min(2).max(120),
  repNameOther: z.string().trim().max(120).optional().or(z.literal("")),
  shortBusinessNote: z.string().trim().max(500).optional().or(z.literal("")),
  acceptCommissionTerms: z.literal(true),
  acceptedDocumentTypes: z
    .array(z.enum(LEGAL_DOCUMENT_TYPES))
    .superRefine((types, ctx) => {
      const set = new Set(types);
      for (const required of MERCHANT_REGISTRATION_DOCUMENT_TYPES) {
        if (!set.has(required)) {
          ctx.addIssue({ code: "custom", message: `Missing consent: ${required}` });
        }
      }
    }),
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
      acceptedDocumentTypes: parsed.data.acceptedDocumentTypes,
      remoteIp: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
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
