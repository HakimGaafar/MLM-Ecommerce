import { listActiveMarketIds } from "@mlm/domain";
import { NextResponse } from "next/server";

/** Public list of launch-active market IDs (offer editors, pickers). */
export async function GET() {
  const marketIds = await listActiveMarketIds();
  return NextResponse.json(
    { marketIds },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
