import { listVendorProductQuestions } from "@mlm/domain";
import { VendorProductQuestionListQuerySchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { requireVendorSession } from "@/lib/require-vendor-session";
import { requireVendorPermission } from "@/lib/require-vendor-permission";

export async function GET(request: NextRequest) {
  const auth = await requireVendorSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const denied = await requireVendorPermission(auth, "vendor:products:qna:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = VendorProductQuestionListQuerySchema.safeParse({
    tab: url.searchParams.get("tab") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const query = parsed.success
    ? parsed.data
    : { tab: "unanswered" as const, page: 1, pageSize: 5 };

  const result = await listVendorProductQuestions({
    vendorId: auth.vendorId,
    tab: query.tab,
    page: query.page,
    pageSize: query.pageSize,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
