import { adminReleaseAllPendingForUser } from "@mlm/domain";
import { AdminSettlementReleaseForUserSchema } from "@mlm/shared";
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
    "admin-settlement-release-user",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const parsed = await parseJsonBody(request, AdminSettlementReleaseForUserSchema);
  if ("error" in parsed) return parsed.error;

  const result = await adminReleaseAllPendingForUser({
    userId: parsed.data.userId,
    settledByUserId: auth.userId,
    entryTypes: parsed.data.entryTypes,
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
