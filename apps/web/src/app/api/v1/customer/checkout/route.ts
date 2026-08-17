import { CheckoutError, placeOrderFromCart } from "@mlm/domain";
import { CheckoutPostSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import {
  exposeErrorCodesToClient,
  publicErrorMessage,
  PUBLIC_API_ERRORS,
  internalServerErrorResponse,
} from "@/lib/api-error-response";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

function checkoutErrorMessage(error: CheckoutError): string {
  return publicErrorMessage(error, PUBLIC_API_ERRORS.checkoutFailed, "customer/checkout");
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceUserRateLimit(request, auth.userId, "checkout-place", 10, 5 * 60 * 1000);
  if (limited) return limited;

  const raw = await request.json().catch(() => ({}));
  const parsed = CheckoutPostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const market = await resolveRequestMarket();
    const order = await placeOrderFromCart(auth.userId, market.id, market.defaultCurrency, {
      paymentMethod: parsed.data.paymentMethod,
      idempotencyKey: parsed.data.idempotencyKey,
      shippingAddressId: parsed.data.shippingAddressId,
      couponCodes:
        parsed.data.couponCodes ??
        (parsed.data.couponCode ? [parsed.data.couponCode] : undefined),
      useWalletBalance: parsed.data.useWalletBalance,
    });
    return NextResponse.json(
      { order },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      const status = error.code === "EMAIL_VERIFICATION_REQUIRED" ? 403 : 400;
      return NextResponse.json(
        {
          error: checkoutErrorMessage(error),
          ...(exposeErrorCodesToClient() ? { code: error.code } : {}),
        },
        { status },
      );
    }
    return internalServerErrorResponse("customer/checkout", error, PUBLIC_API_ERRORS.checkoutFailed);
  }
}
