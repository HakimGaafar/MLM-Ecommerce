import { getAdminPlatformConfig, updateAdminPlatformConfig } from "@mlm/domain";
import { AdminPlatformConfigUpdateSchema, getMarketId, isMarketCode } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

function resolveMarketIdFromRequest(request: NextRequest): string | null {
  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (marketCode && isMarketCode(marketCode)) {
    return getMarketId(marketCode);
  }
  const marketId = request.nextUrl.searchParams.get("marketId")?.trim();
  return marketId || null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const marketId = resolveMarketIdFromRequest(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  try {
    const config = await getAdminPlatformConfig(marketId);
    return NextResponse.json({ config });
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

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-platform-settings",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const marketId = resolveMarketIdFromRequest(request);
  if (!marketId) {
    return NextResponse.json({ error: "marketCode or marketId is required" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AdminPlatformConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const config = await updateAdminPlatformConfig({
      marketId,
      actorUserId: auth.userId,
      input: parsed.data,
    });
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof Error && error.message === "MARKET_NOT_FOUND") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    throw error;
  }
}
