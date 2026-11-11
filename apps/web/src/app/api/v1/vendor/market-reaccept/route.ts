import {
  completeMarketReaccept,
  getPendingMarketReaccept,
  MarketGoLiveError,
} from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/security";
import { requireVendorSession } from "@/lib/require-vendor-session";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pending = await getPendingMarketReaccept(auth.userId);
  return NextResponse.json({ pending });
}

export async function POST(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await completeMarketReaccept({
      userId: auth.userId,
      remoteIp: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, marketCode: result.marketCode });
  } catch (error) {
    if (error instanceof MarketGoLiveError) {
      const status = error.code === "NO_PENDING_REACCEPT" ? 400 : 403;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
