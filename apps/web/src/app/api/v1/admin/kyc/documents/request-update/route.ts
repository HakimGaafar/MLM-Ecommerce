import { AdminKycError, requestAdminKycDocumentUpdate } from "@mlm/domain";
import { AdminKycRequestUpdateSchema } from "@mlm/shared";
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
    "admin-kyc-request-update",
    20,
    10 * 60 * 1000,
  );
  if (limited) return limited;

  const parsed = await parseJsonBody(request, AdminKycRequestUpdateSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const count = await requestAdminKycDocumentUpdate({
      documentIds: parsed.data.documentIds,
      adminUserId: auth.userId,
      message: parsed.data.message,
    });
    return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminKycError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}
