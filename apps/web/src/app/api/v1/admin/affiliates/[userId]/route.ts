import {
  AdminAffiliateError,
  getAdminAffiliateDetail,
  updateAdminAffiliateRank,
} from "@mlm/domain";
import { AdminAffiliateRankPatchSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ userId: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await context.params;
  const detail = await getAdminAffiliateDetail(userId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ userId: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(
    request,
    auth.userId,
    "admin-affiliate-rank",
    30,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const { userId } = await context.params;
  const parsed = await parseJsonBody(request, AdminAffiliateRankPatchSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const detail = await updateAdminAffiliateRank({
      userId,
      rankTitle: parsed.data.rankTitle,
    });
    return NextResponse.json({ detail });
  } catch (error) {
    if (error instanceof AdminAffiliateError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
