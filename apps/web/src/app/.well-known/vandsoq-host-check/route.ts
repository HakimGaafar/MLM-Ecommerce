import { getMarketHostCheckToken } from "@mlm/shared";
import { NextResponse } from "next/server";

/**
 * Public host proof for market subdomain DNS verification.
 * Admin verify / publish probes this path and requires a matching token.
 */
export async function GET() {
  const token = getMarketHostCheckToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "MARKET_HOST_CHECK_TOKEN is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "vandsoq",
      token,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Vandsoq-Host-Check": token,
      },
    },
  );
}
