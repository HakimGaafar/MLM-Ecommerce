import { listAdminShippingRequests } from "@mlm/domain";
import { AdminShippingRequestListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = AdminShippingRequestListQuerySchema.safeParse({
    tab: request.nextUrl.searchParams.get("tab") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });
  const tab = parsed.success ? parsed.data.tab : "pending";
  const page = parsed.success ? parsed.data.page : 1;
  const pageSize = parsed.success ? parsed.data.pageSize : 10;

  const result = await listAdminShippingRequests(tab, { page, pageSize });
  return NextResponse.json({ tab, ...result }, { headers: { "Cache-Control": "no-store" } });
}
