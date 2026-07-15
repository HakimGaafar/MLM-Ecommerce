import { listAdminUsers } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listAdminUsers({ page, pageSize });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
