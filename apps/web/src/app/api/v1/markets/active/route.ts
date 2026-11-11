import { listActiveMarketsForOffers } from "@mlm/domain";
import { NextResponse } from "next/server";

/** Public list of launch-active markets (offer editors, pickers). */
export async function GET() {
  const markets = await listActiveMarketsForOffers();
  return NextResponse.json(
    {
      marketIds: markets.map((m) => m.id),
      markets,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
