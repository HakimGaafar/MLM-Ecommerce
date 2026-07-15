import { CheckoutError, getCheckoutQuoteForUser } from "@mlm/domain";
import { CheckoutCouponCodeSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireCustomerSession } from "@/lib/require-customer-session";
import { resolveRequestMarket } from "@/lib/request-market";

function quoteErrorMessage(error: CheckoutError): string {
  return error.message || "Checkout quote failed";
}

export async function GET(request: NextRequest) {
  const auth = await requireCustomerSession(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceUserRateLimit(request, auth.userId, "checkout-quote", 30, 5 * 60 * 1000);
  if (limited) return limited;

  const rawCodes = request.nextUrl.searchParams.get("couponCodes");
  const rawCode = request.nextUrl.searchParams.get("couponCode");
  const useWalletBalanceRaw = request.nextUrl.searchParams.get("useWalletBalance");
  const shippingAddressId = request.nextUrl.searchParams.get("shippingAddressId");
  const useWalletBalance = useWalletBalanceRaw === "1" || useWalletBalanceRaw === "true";
  let couponCodes: string[] | undefined;

  if (rawCodes != null && rawCodes.trim() !== "") {
    const parts = rawCodes
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const parsedCodes: string[] = [];
    for (const part of parts) {
      const parsed = CheckoutCouponCodeSchema.safeParse(part);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid coupon code format", code: "INVALID_COUPON" },
          { status: 400 },
        );
      }
      parsedCodes.push(parsed.data);
    }
    couponCodes = parsedCodes;
  } else if (rawCode != null && rawCode.trim() !== "") {
    const parsed = CheckoutCouponCodeSchema.safeParse(rawCode);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid coupon code format", code: "INVALID_COUPON" }, { status: 400 });
    }
    couponCodes = [parsed.data];
  }

  try {
    const market = await resolveRequestMarket();
    const quote = await getCheckoutQuoteForUser(auth.userId, market.id, {
      couponCodes,
      useWalletBalance,
      shippingAddressId,
    });
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { error: quoteErrorMessage(error), code: error.code },
        { status: 400 },
      );
    }
    throw error;
  }
}
