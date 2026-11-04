import { FxRateError, listFxRates, upsertManualFxRate } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { publicErrorPayload } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromCurrency = searchParams.get("from") ?? undefined;
  const toCurrency = searchParams.get("to") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const rates = await listFxRates({ fromCurrency, toCurrency, limit });
  return NextResponse.json({ rates }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    fromCurrency?: string;
    toCurrency?: string;
    rate?: number | string;
    effectiveAt?: string;
  } | null;

  if (!body?.fromCurrency || !body?.toCurrency || body.rate == null) {
    return NextResponse.json(
      { error: "fromCurrency, toCurrency, and rate are required." },
      { status: 400 },
    );
  }

  const rate = typeof body.rate === "string" ? Number(body.rate) : body.rate;
  const effectiveAt = body.effectiveAt ? new Date(body.effectiveAt) : undefined;
  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) {
    return NextResponse.json({ error: "Invalid effectiveAt." }, { status: 400 });
  }

  try {
    const row = await upsertManualFxRate({
      fromCurrency: body.fromCurrency,
      toCurrency: body.toCurrency,
      rate,
      effectiveAt,
      createdByUserId: auth.userId,
    });
    return NextResponse.json({ rate: row }, { status: 201 });
  } catch (e) {
    if (e instanceof FxRateError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(publicErrorPayload(e, { context: "api", code: e.code }), { status });
    }
    throw e;
  }
}
