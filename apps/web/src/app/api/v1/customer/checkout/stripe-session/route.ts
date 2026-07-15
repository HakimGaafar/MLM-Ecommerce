import { CheckoutError, createStripeCheckoutSession, StripeCheckoutError } from "@mlm/domain";
import { CheckoutPostSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { resolveCheckoutBaseUrl } from "@/lib/resolve-checkout-base-url";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

function stripeErrorResponse(error: StripeCheckoutError) {
  const status =
    error.code === "NOT_CONFIGURED"
      ? 503
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "ALREADY_PAID"
          ? 409
          : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceUserRateLimit(request, auth.userId, "checkout-stripe", 10, 5 * 60 * 1000);
  if (limited) return limited;

  const raw = await request.json().catch(() => ({}));
  const parsed = CheckoutPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const appBaseUrl = resolveCheckoutBaseUrl(request);

  try {
    const market = await resolveRequestMarket();
    const result = await createStripeCheckoutSession(
      auth.userId,
      market.id,
      {
        idempotencyKey: parsed.data.idempotencyKey,
        shippingAddressId: parsed.data.shippingAddressId,
        couponCodes:
          parsed.data.couponCodes ??
          (parsed.data.couponCode ? [parsed.data.couponCode] : undefined),
        useWalletBalance: parsed.data.useWalletBalance,
      },
      { appBaseUrl },
    );
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StripeCheckoutError) {
      return stripeErrorResponse(error);
    }
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
