import { listAdminMarkets, updateAdminMarket } from "@mlm/domain";
import { AdminMarketUpdateSchema, isMarketCode, isMarketCodeFormat, type MarketCode } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const markets = await listAdminMarkets();
  return NextResponse.json({ markets });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "admin-markets", 30, 10 * 60 * 1000);
  if (limited) return limited;

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode || !isMarketCodeFormat(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }
  // Known codes use typed path; DB-created codes (AE, …) use string cast for enable/edit.
  if (!isMarketCode(marketCode)) {
    // Allow PATCH for wizard-created markets that are not in MARKET_CODES.
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminMarketUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const market = await updateAdminMarket({
      marketCode: marketCode as MarketCode,
      input: parsed.data,
    });
    return NextResponse.json({ market });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    if (error.message === "CANNOT_DISABLE_DEFAULT_MARKET") {
      return NextResponse.json(
        { error: "Saudi Arabia is the default market and cannot be disabled." },
        { status: 400 },
      );
    }
    if (error.message === "LAST_ACTIVE_MARKET") {
      return NextResponse.json(
        { error: "At least one marketplace must remain active." },
        { status: 400 },
      );
    }
    if (error.message === "DEFAULT_CURRENCY_NOT_IN_PAYMENT_CURRENCIES") {
      return NextResponse.json(
        { error: "Default currency must be one of the payment currencies." },
        { status: 400 },
      );
    }
    if (error.message === "PAPERS_INCOMPLETE") {
      return NextResponse.json(
        {
          error:
            "Complete annex company papers (legal name, CR/unified number, address, contact) before opening this market.",
          code: "PAPERS_INCOMPLETE",
        },
        { status: 400 },
      );
    }
    if (error.message === "PAYMENT_CURRENCY_MISSING") {
      return NextResponse.json(
        {
          error: "Add the market default currency to payment currencies before opening.",
          code: "PAYMENT_CURRENCY_MISSING",
        },
        { status: 400 },
      );
    }
    if (error.message === "DNS_NOT_VERIFIED") {
      return NextResponse.json(
        {
          error:
            "Live DNS/host verification failed. Point the market subdomain at the platform, then enable again (or use the Add Market wizard Verify DNS).",
          code: "DNS_NOT_VERIFIED",
        },
        { status: 400 },
      );
    }
    if (error.message === "ROUTING_NOT_BOUND") {
      return NextResponse.json(
        {
          error: "Subdomain and geo binding incomplete for this market.",
          code: "ROUTING_NOT_BOUND",
        },
        { status: 400 },
      );
    }
    if (
      error.message === "NOT_READY" ||
      error.message === "GATEWAY_CURRENCY_UNSUPPORTED" ||
      error.message === "CONFIG_MISSING" ||
      error.message === "REFUND_RULES_MISSING" ||
      error.message === "INVOICING_RULES_MISSING" ||
      error.message === "SHIPPING_RATES_MISSING" ||
      error.message === "POLICIES_INCOMPLETE"
    ) {
      return NextResponse.json(
        {
          error: `Market pack incomplete (${error.message}). Finish the Add Market wizard checklist before enabling.`,
          code: error.message,
        },
        { status: 400 },
      );
    }
    throw error;
  }
}
