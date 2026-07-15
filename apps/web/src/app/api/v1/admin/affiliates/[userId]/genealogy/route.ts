import { getAffiliateGenealogy } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(
  request: NextRequest,
  context: Readonly<{ params: Promise<{ userId: string }> }>,
) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await context.params;
  const url = new URL(request.url);
  const maxDepth = Math.min(4, Math.max(1, Number.parseInt(url.searchParams.get("depth") ?? "3", 10) || 3));

  const result = await getAffiliateGenealogy({ rootUserId: userId, maxDepth });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
