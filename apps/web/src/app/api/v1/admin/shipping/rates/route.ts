import { listShippingRates, resolveMarketIdByCode, updateShippingRateAmount } from "@mlm/domain";
import { AdminShippingRateUpdateSchema, isMarketCodeFormat } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  let marketId: string | undefined;
  if (marketCode && isMarketCodeFormat(marketCode)) {
    try {
      marketId = await resolveMarketIdByCode(marketCode);
    } catch {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
  }
  const rates = await listShippingRates(marketId ? { marketId } : undefined);
  return NextResponse.json({ rates }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await request.json().catch(() => null);
  const parsed = AdminShippingRateUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }

  if (!isMarketCodeFormat(parsed.data.marketCode)) {
    return NextResponse.json({ error: "Invalid market code" }, { status: 400 });
  }

  try {
    const marketId = await resolveMarketIdByCode(parsed.data.marketCode);
    const rate = await updateShippingRateAmount({
      marketId,
      code: parsed.data.code,
      amount: parsed.data.amount,
      perUnit: parsed.data.perUnit,
      isActive: parsed.data.isActive,
    });
    return NextResponse.json({ rate }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Rate not found" }, { status: 404 });
  }
}
