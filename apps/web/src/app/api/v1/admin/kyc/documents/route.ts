import { AdminKycError, listAdminKycDocuments } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";
import { publicErrorMessage, publicErrorPayload, PUBLIC_API_ERRORS } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tab = request.nextUrl.searchParams.get("tab");
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20");

  const safeTab =
    tab === "accepted" || tab === "rejected" || tab === "pending" ? tab : "pending";

  try {
    const result = await listAdminKycDocuments({ tab: safeTab, page, pageSize });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminKycError) {
      return NextResponse.json(publicErrorPayload(error, { context: "api", code: error.code }), { status: 400 });
    }
    throw error;
  }
}
