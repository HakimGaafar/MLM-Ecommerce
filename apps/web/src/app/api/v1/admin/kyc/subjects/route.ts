import { AdminKycError, listAdminKycSubjectGroups } from "@mlm/domain";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scopeParam = request.nextUrl.searchParams.get("scope");
  const scope = scopeParam === "customer" ? "customer" : "vendor";
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  try {
    const groups = await listAdminKycSubjectGroups({ scope, search });
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminKycError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
