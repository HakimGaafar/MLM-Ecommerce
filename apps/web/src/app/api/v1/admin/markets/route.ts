import { listAdminMarkets, setMarketActive } from "@mlm/domain";
import { AdminMarketActiveUpdateSchema, isMarketCode } from "@mlm/shared";
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
  if (!marketCode || !isMarketCode(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminMarketActiveUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const market = await setMarketActive({
      marketCode,
      isActive: parsed.data.isActive,
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
    throw error;
  }
}
