import type { KycDocumentStatus, KycDocumentType, KycSubjectType } from "@mlm/db";
import { prisma, raceSafeUpsert } from "@mlm/db";
import { getKycExpiryWarning, type KycExpiryWarning } from "./kyc-expiry";
import {
  buildKycSubjectKey,
  KYC_REQUIRED_DOCUMENTS,
  kycDocumentTypeRequiresExpiry,
  kycDocumentTypeSupportsIbanNumber,
} from "./kyc-requirements";

export type KycDocumentDto = {
  id: string;
  subjectType: KycSubjectType;
  documentType: KycDocumentType;
  status: KycDocumentStatus | "NOT_UPLOADED";
  originalFileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  documentExpiresAt: string | null;
  ibanNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string | null;
  expiryWarning: KycExpiryWarning;
  updateRequestedAt: string | null;
  updateRequestMessage: string | null;
};

export type KycAdminUpdateRequestDto = {
  documentType: KycDocumentType;
  message: string | null;
};

export type KycStatusSummaryDto = {
  subjectType: KycSubjectType;
  approved: boolean;
  idExpired: boolean;
  documents: KycDocumentDto[];
  adminUpdateRequests: KycAdminUpdateRequestDto[];
};

export class KycDocumentError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INVALID_DOCUMENT_TYPE"
      | "INVALID_STATUS"
      | "MISSING_EXPIRY"
      | "MISSING_IBAN"
      | "FORBIDDEN"
      | "ALREADY_PENDING",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "KycDocumentError";
  }
}

function mapRow(row: {
  id: string;
  subjectType: KycSubjectType;
  documentType: KycDocumentType;
  status: KycDocumentStatus;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentExpiresAt: Date | null;
  ibanNumber: string | null;
  rejectionReason: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  updatedAt: Date;
  updateRequestedAt?: Date | null;
  updateRequestMessage?: string | null;
}): KycDocumentDto {
  return {
    id: row.id,
    subjectType: row.subjectType,
    documentType: row.documentType,
    status: row.status,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    documentExpiresAt: row.documentExpiresAt?.toISOString() ?? null,
    ibanNumber: row.ibanNumber,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    expiryWarning: getKycExpiryWarning(row.documentExpiresAt),
    updateRequestedAt: row.updateRequestedAt?.toISOString() ?? null,
    updateRequestMessage: row.updateRequestMessage ?? null,
  };
}

function emptyDocumentDto(subjectType: KycSubjectType, documentType: KycDocumentType): KycDocumentDto {
  return {
    id: "",
    subjectType,
    documentType,
    status: "NOT_UPLOADED",
    originalFileName: null,
    mimeType: null,
    fileSizeBytes: null,
    documentExpiresAt: null,
    ibanNumber: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    updatedAt: null,
    expiryWarning: "none",
    updateRequestedAt: null,
    updateRequestMessage: null,
  };
}

function subjectScope(params: {
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): { subjectKey: string; userId: string | null; vendorId: string | null } {
  if (params.subjectType === "VENDOR") {
    if (!params.vendorId) throw new KycDocumentError("FORBIDDEN", "Vendor context required.");
    return {
      subjectKey: buildKycSubjectKey("VENDOR", params.vendorId),
      userId: null,
      vendorId: params.vendorId,
    };
  }
  if (!params.userId) throw new KycDocumentError("FORBIDDEN", "User context required.");
  return {
    subjectKey: buildKycSubjectKey(params.subjectType, params.userId),
    userId: params.userId,
    vendorId: null,
  };
}

export async function syncExpiredKycDocuments(params: {
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): Promise<void> {
  const { subjectKey } = subjectScope(params);
  const now = new Date();
  await prisma.kycDocument.updateMany({
    where: {
      subjectKey,
      status: "ACCEPTED",
      documentExpiresAt: { lt: now },
      documentType: { in: ["NATIONAL_ID", "REPRESENTATIVE_ID"] },
    },
    data: { status: "EXPIRED" },
  });
}

export async function getKycStatusSummary(params: {
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): Promise<KycStatusSummaryDto> {
  await syncExpiredKycDocuments(params);
  const { subjectKey } = subjectScope(params);
  const required = KYC_REQUIRED_DOCUMENTS[params.subjectType];
  const rows = await prisma.kycDocument.findMany({
    where: { subjectKey, documentType: { in: required } },
  });
  const byType = new Map(rows.map((row) => [row.documentType, row]));

  const documents = required.map((documentType) => {
    const row = byType.get(documentType);
    return row ? mapRow(row) : emptyDocumentDto(params.subjectType, documentType);
  });

  const idTypes: KycDocumentType[] =
    params.subjectType === "VENDOR" ? ["REPRESENTATIVE_ID"] : ["NATIONAL_ID"];
  const idExpired = idTypes.some((documentType) => {
    const doc = byType.get(documentType);
    return doc?.status === "EXPIRED";
  });

  const approved = required.every((documentType) => byType.get(documentType)?.status === "ACCEPTED");

  const adminUpdateRequests: KycAdminUpdateRequestDto[] = documents
    .filter((doc) => doc.updateRequestedAt)
    .map((doc) => ({
      documentType: doc.documentType,
      message: doc.updateRequestMessage,
    }));

  return {
    subjectType: params.subjectType,
    approved,
    idExpired,
    documents,
    adminUpdateRequests,
  };
}

export async function upsertKycDocumentUpload(params: {
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
  documentType: KycDocumentType;
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentExpiresAt?: Date | null;
  ibanNumber?: string | null;
}): Promise<KycDocumentDto> {
  const required = KYC_REQUIRED_DOCUMENTS[params.subjectType];
  if (!required.includes(params.documentType)) {
    throw new KycDocumentError("INVALID_DOCUMENT_TYPE");
  }

  const scope = subjectScope(params);

  const existing = await prisma.kycDocument.findUnique({
    where: {
      subjectKey_documentType: {
        subjectKey: scope.subjectKey,
        documentType: params.documentType,
      },
    },
  });

  if (existing?.status === "PENDING_REVIEW") {
    throw new KycDocumentError(
      "ALREADY_PENDING",
      "This document is already awaiting admin review.",
    );
  }

  const documentExpiresAt =
    params.documentExpiresAt ??
    (existing?.documentExpiresAt && kycDocumentTypeRequiresExpiry(params.documentType)
      ? existing.documentExpiresAt
      : null);

  if (kycDocumentTypeRequiresExpiry(params.documentType) && !documentExpiresAt) {
    throw new KycDocumentError("MISSING_EXPIRY", "Document expiry date is required.");
  }

  const ibanNumber =
    params.ibanNumber?.trim() ||
    (kycDocumentTypeSupportsIbanNumber(params.documentType) ? existing?.ibanNumber?.trim() : null) ||
    null;

  if (kycDocumentTypeSupportsIbanNumber(params.documentType) && !ibanNumber) {
    throw new KycDocumentError("MISSING_IBAN", "IBAN number is required.");
  }

  const kycWhere = {
    subjectKey_documentType: {
      subjectKey: scope.subjectKey,
      documentType: params.documentType,
    },
  };

  const row = await raceSafeUpsert({
    upsert: () =>
      prisma.kycDocument.upsert({
        where: kycWhere,
        create: {
          subjectType: params.subjectType,
          subjectKey: scope.subjectKey,
          userId: scope.userId,
          vendorId: scope.vendorId,
          documentType: params.documentType,
          status: "UPLOADED",
          storageKey: params.storageKey,
          originalFileName: params.originalFileName,
          mimeType: params.mimeType,
          fileSizeBytes: params.fileSizeBytes,
          documentExpiresAt,
          ibanNumber,
          rejectionReason: null,
          reviewedByUserId: null,
          reviewedAt: null,
          submittedAt: null,
        },
        update: {
          status: "UPLOADED",
          storageKey: params.storageKey,
          originalFileName: params.originalFileName,
          mimeType: params.mimeType,
          fileSizeBytes: params.fileSizeBytes,
          documentExpiresAt,
          ibanNumber,
          rejectionReason: null,
          reviewedByUserId: null,
          reviewedAt: null,
          submittedAt: null,
        },
      }),
    findUnique: () => prisma.kycDocument.findUnique({ where: kycWhere }),
  });

  return mapRow(row);
}

export async function submitKycDocumentForReview(params: {
  documentId: string;
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): Promise<KycDocumentDto> {
  const scope = subjectScope(params);
  const row = await prisma.kycDocument.findFirst({
    where: { id: params.documentId, subjectKey: scope.subjectKey },
  });
  if (!row) throw new KycDocumentError("NOT_FOUND");

  if (row.status !== "UPLOADED" && row.status !== "REJECTED" && row.status !== "EXPIRED") {
    throw new KycDocumentError("INVALID_STATUS", "Only uploaded documents can be submitted.");
  }

  const updated = await prisma.kycDocument.update({
    where: { id: row.id },
    data: {
      status: "PENDING_REVIEW",
      submittedAt: new Date(),
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
    },
  });

  return mapRow(updated);
}

/** Remove a draft upload (UPLOADED only, before admin review). Returns storage key for file cleanup. */
export async function discardKycDocumentUpload(params: {
  documentId: string;
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): Promise<{ storageKey: string }> {
  const scope = subjectScope(params);
  const row = await prisma.kycDocument.findFirst({
    where: { id: params.documentId, subjectKey: scope.subjectKey },
  });
  if (!row) throw new KycDocumentError("NOT_FOUND");

  if (row.status !== "UPLOADED") {
    throw new KycDocumentError(
      "INVALID_STATUS",
      "Only uploaded (not yet submitted) documents can be removed.",
    );
  }

  await prisma.kycDocument.delete({ where: { id: row.id } });
  return { storageKey: row.storageKey };
}

export async function getKycDocumentForSubject(params: {
  documentId: string;
  subjectType: KycSubjectType;
  userId?: string;
  vendorId?: string;
}): Promise<{ id: string; storageKey: string; mimeType: string; originalFileName: string }> {
  const scope = subjectScope(params);
  const row = await prisma.kycDocument.findFirst({
    where: { id: params.documentId, subjectKey: scope.subjectKey },
    select: { id: true, storageKey: true, mimeType: true, originalFileName: true },
  });
  if (!row) throw new KycDocumentError("NOT_FOUND");
  return row;
}
