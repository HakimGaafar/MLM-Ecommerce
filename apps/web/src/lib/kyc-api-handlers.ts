import {
  discardKycDocumentUpload,
  getKycStatusSummary,
  getKycDocumentForSubject,
  KycDocumentError,
  submitKycDocumentForReview,
  upsertKycDocumentUpload,
} from "@mlm/domain";
import type { KycSubjectType } from "@mlm/db";
import { NextRequest, NextResponse } from "next/server";
import { enforceUserRateLimit } from "@/lib/rate-limit-response";
import { parseKycUploadForm, persistKycUpload } from "@/lib/kyc-upload";
import { deleteKycDocument, readKycDocument } from "@/lib/kyc-storage/store";

type SubjectContext = {
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
};

function kycErrorResponse(error: KycDocumentError) {
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "INVALID_STATUS" || error.code === "ALREADY_PENDING"
          ? 409
          : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function handleKycGet(context: SubjectContext) {
  const summary = await getKycStatusSummary(context);
  return NextResponse.json({ summary }, { headers: { "Cache-Control": "no-store" } });
}

export async function handleKycUpload(
  request: NextRequest,
  context: SubjectContext,
  actorUserId: string,
) {
  const limited = await enforceUserRateLimit(request, actorUserId, "kyc-upload", 15, 15 * 60 * 1000);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const parsed = await parseKycUploadForm(form);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const subjectId = context.vendorId ?? context.userId;
  if (!subjectId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { storageKey } = await persistKycUpload({
      subjectType: context.subjectType,
      subjectId,
      parsed,
    });
    const document = await upsertKycDocumentUpload({
      ...context,
      documentType: parsed.documentType,
      storageKey,
      originalFileName: parsed.originalFileName,
      mimeType: parsed.mimeType,
      fileSizeBytes: parsed.fileSizeBytes,
      documentExpiresAt: parsed.documentExpiresAt,
      ibanNumber: parsed.ibanNumber,
    });
    return NextResponse.json({ document }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof KycDocumentError) return kycErrorResponse(error);
    throw error;
  }
}

export async function handleKycSubmit(context: SubjectContext, documentId: string) {
  try {
    const document = await submitKycDocumentForReview({ ...context, documentId });
    return NextResponse.json({ document }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof KycDocumentError) return kycErrorResponse(error);
    throw error;
  }
}

export async function handleKycDiscard(context: SubjectContext, documentId: string) {
  try {
    const { storageKey } = await discardKycDocumentUpload({ ...context, documentId });
    await deleteKycDocument(storageKey);
    const summary = await getKycStatusSummary(context);
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof KycDocumentError) return kycErrorResponse(error);
    throw error;
  }
}

export async function handleKycFileDownload(context: SubjectContext, documentId: string) {
  try {
    const meta = await getKycDocumentForSubject({ ...context, documentId });
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
    if (error instanceof KycDocumentError) return kycErrorResponse(error);
    throw error;
  }
}
