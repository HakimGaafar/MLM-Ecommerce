import { onboardNewSeller, ReferralBindError, SellerOnboardError } from "@mlm/domain";
import { SellerOnboardSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getClientIp, isStrongPassword } from "@/lib/security";
import { resolveRequestMarket } from "@/lib/request-market";
import { publicErrorMessage, publicErrorPayload, PUBLIC_API_ERRORS } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const throttle = await consumeRateLimit(`seller-onboard:${ip}`, 6, 15 * 60 * 1000);
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": `${throttle.retryAfterSeconds}` } },
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = SellerOnboardSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!isStrongPassword(parsed.data.password)) {
    return NextResponse.json(
      { error: "Password must include upper, lower, number, and symbol" },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const result = await onboardNewSeller(parsed.data, market.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ReferralBindError) {
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status: 400 });
    }
    if (e instanceof SellerOnboardError) {
      const status =
        e.code === "EMAIL_IN_USE" || e.code === "SLUG_TAKEN" || e.code === "USERNAME_IN_USE"
          ? 409
          : e.code === "SLUG_RESERVED"
            ? 400
            : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status });
    }
    throw e;
  }
}
