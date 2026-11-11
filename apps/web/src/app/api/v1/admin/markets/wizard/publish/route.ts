import { AdminMarketWizardError, publishMarketWizard } from "@mlm/domain";
import { isMarketCodeFormat } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-market-publish",
    10,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const marketCode = request.nextUrl.searchParams.get("marketCode")?.trim().toUpperCase();
  if (!marketCode || !isMarketCodeFormat(marketCode)) {
    return NextResponse.json({ error: "Valid marketCode is required" }, { status: 400 });
  }

  try {
    const result = await publishMarketWizard(marketCode);
    return NextResponse.json({
      state: result.state,
      migratedVendors: result.migratedVendors,
      flaggedUsers: result.flaggedUsers,
    });
  } catch (error) {
    if (error instanceof AdminMarketWizardError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "ALREADY_LIVE" ? 409 : 400 },
      );
    }
    throw error;
  }
}
