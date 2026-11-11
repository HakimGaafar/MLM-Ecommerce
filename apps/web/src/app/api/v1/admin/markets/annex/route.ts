import { getAdminMarketAnnex, updateAdminMarketAnnex } from "@mlm/domain";
import { AdminMarketAnnexUpdateSchema, isMarketCode, type MarketCode } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

function parseMarketCode(request: NextRequest): MarketCode | null {
  const raw = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  return raw && isMarketCode(raw) ? raw : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketCode = parseMarketCode(request);
  if (!marketCode) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  try {
    const annex = await getAdminMarketAnnex(marketCode);
    return NextResponse.json({ annex });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "admin-market-annex", 30, 10 * 60 * 1000);
  if (limited) return limited;

  const marketCode = parseMarketCode(request);
  if (!marketCode) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminMarketAnnexUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const annex = await updateAdminMarketAnnex({ marketCode, input: parsed.data });
    return NextResponse.json({ annex });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    if (error.message === "ISSUER_NOT_FOUND") {
      return NextResponse.json({ error: "Market issuer not found" }, { status: 404 });
    }
    if (error.message === "DEFAULT_CURRENCY_NOT_IN_PAYMENT_CURRENCIES") {
      return NextResponse.json(
        { error: "Default currency must be one of the payment currencies." },
        { status: 400 },
      );
    }
    throw error;
  }
}
