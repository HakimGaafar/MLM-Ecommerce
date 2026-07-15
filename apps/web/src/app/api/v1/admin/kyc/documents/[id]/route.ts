import { AdminKycError, getAdminKycDocumentFileMeta, reviewAdminKycDocument } from "@mlm/domain";
import { AdminKycReviewSchema } from "@mlm/shared";
import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/parse-json-body";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { requireAdminSession } from "@/lib/require-admin-session";
import { readKycDocument } from "@/lib/kyc-storage/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limited = await enforceUserRateLimit(request, auth.userId, "admin-kyc-review", 40, 10 * 60 * 1000);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await parseJsonBody(request, AdminKycReviewSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const item = await reviewAdminKycDocument({
      documentId: id,
      reviewerUserId: auth.userId,
      action: parsed.data.action,
      rejectionReason: parsed.data.rejectionReason,
    });
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminKycError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_PENDING" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireAdminSession(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    const meta = await getAdminKycDocumentFileMeta(id);
    const buffer = await readKycDocument(meta.storageKey);
    if (!buffer) return NextResponse.json({ error: "File not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(meta.originalFileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AdminKycError) {
      const status = error.code === "DRAFT_NOT_SUBMITTED" ? 403 : 404;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
