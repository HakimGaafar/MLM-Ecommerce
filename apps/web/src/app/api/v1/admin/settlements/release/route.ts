import { adminReleasePendingSettlements } from "@mlm/domain";
import { AdminSettlementReleaseSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-settlement-release",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const parsed = await parseJsonBody(request, AdminSettlementReleaseSchema);
  if ("error" in parsed) return parsed.error;

  const result = await adminReleasePendingSettlements({
    transactionIds: parsed.data.transactionIds,
    settledByUserId: auth.userId,
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
