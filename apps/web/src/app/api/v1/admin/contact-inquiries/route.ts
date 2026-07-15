import { listContactInquiries } from "@mlm/domain";
import { ContactInquiryStatusSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parsePaginationSearchParams } from "@/lib/api-pagination";
import { requireSuperAdminSession } from "@/lib/require-super-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawStatus = request.nextUrl.searchParams.get("status");
  const parsedStatus = rawStatus ? ContactInquiryStatusSchema.safeParse(rawStatus) : null;
  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const { page, pageSize } = parsePaginationSearchParams(request.nextUrl.searchParams);
  const result = await listContactInquiries({
    page,
    pageSize,
    status: parsedStatus?.success ? parsedStatus.data : undefined,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
