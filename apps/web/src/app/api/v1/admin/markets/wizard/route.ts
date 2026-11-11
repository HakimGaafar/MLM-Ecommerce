import {
  AdminMarketWizardError,
  deleteWizardDraftMarket,
  getMarketWizardState,
  listAvailableAddMarketCountries,
  listWizardDraftMarkets,
  startMarketWizard,
} from "@mlm/domain";
import { AdminMarketWizardStartSchema, isMarketCodeFormat } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode) {
    const [countries, drafts] = await Promise.all([
      listAvailableAddMarketCountries(),
      listWizardDraftMarkets(),
    ]);
    return NextResponse.json({ countries, drafts });
  }
  if (!isMarketCodeFormat(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  try {
    const state = await getMarketWizardState(marketCode);
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof AdminMarketWizardError && error.code === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-market-wizard-delete",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode || !isMarketCodeFormat(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  try {
    await deleteWizardDraftMarket(marketCode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminMarketWizardError) {
      const status =
        error.code === "MARKET_NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN" || error.code === "ALREADY_LIVE" || error.code === "HAS_VENDORS"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-market-wizard",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = AdminMarketWizardStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const state = await startMarketWizard({
      countryCode: parsed.data.countryCode,
      cloneFrom: parsed.data.cloneFrom,
    });
    return NextResponse.json({ state });
  } catch (error) {
    if (error instanceof AdminMarketWizardError) {
      const status = error.code === "MARKET_EXISTS" || error.code === "COUNTRY_UNAVAILABLE" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
