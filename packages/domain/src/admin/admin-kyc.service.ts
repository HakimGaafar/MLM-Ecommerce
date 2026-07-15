import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import type { KycDocumentStatus, KycDocumentType, KycSubjectType } from "@mlm/db";
import { prisma } from "@mlm/db";
import { getKycExpiryWarning, type KycExpiryWarning } from "../kyc/kyc-expiry";
import { KycDocumentError } from "../kyc/kyc-document.service";

export type AdminKycScopeTab = "vendor" | "customer";

export type AdminKycDocumentDto = {
  id: string;
  subjectType: KycSubjectType;
  subjectKey: string;
  documentType: KycDocumentType;
  status: KycDocumentStatus;
  subjectLabel: string;
  subjectEmail: string | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  documentExpiresAt: string | null;
  ibanNumber: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  expiryWarning: KycExpiryWarning;
  updateRequestedAt: string | null;
  updateRequestMessage: string | null;
};

export type AdminKycSubjectGroupDto = {
  subjectKey: string;
  subjectType: KycSubjectType;
  subjectLabel: string;
  subjectEmail: string | null;
  documents: AdminKycDocumentDto[];
};

export class AdminKycError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "NOT_PENDING" | "INVALID_ACTION" | "DRAFT_NOT_SUBMITTED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminKycError";
  }
}

type KycTab = "pending" | "accepted" | "rejected";

function tabToStatuses(tab: KycTab): KycDocumentStatus[] {
  if (tab === "pending") return ["PENDING_REVIEW"];
  if (tab === "accepted") return ["ACCEPTED", "EXPIRED"];
  return ["REJECTED"];
}

function resolveSubjectLabel(row: {
  subjectType: KycSubjectType;
  subjectKey: string;
  userId: string | null;
  vendorId: string | null;
  user: { name: string; email: string } | null;
  vendor: { storeName: string; owner: { email: string } } | null;
}): { subjectLabel: string; subjectEmail: string | null } {
  if (row.subjectType === "VENDOR" && row.vendor) {
    return { subjectLabel: row.vendor.storeName, subjectEmail: row.vendor.owner.email };
  }
  if (row.user) {
    const role =
      row.subjectType === "AFFILIATE" ? "Affiliate" : row.subjectType === "CUSTOMER" ? "Customer" : "";
    return {
      subjectLabel: role ? `${row.user.name} (${role})` : row.user.name,
      subjectEmail: row.user.email,
    };
  }
  return { subjectLabel: row.subjectKey, subjectEmail: null };
}

function mapAdminRow(
  row: {
    id: string;
    subjectType: KycSubjectType;
    subjectKey: string;
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
    createdAt: Date;
    updateRequestedAt?: Date | null;
    updateRequestMessage?: string | null;
    user: { name: string; email: string } | null;
    vendor: { storeName: string; owner: { email: string } } | null;
  },
  subjectLabel: string,
  subjectEmail: string | null,
): AdminKycDocumentDto {
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectKey: row.subjectKey,
    documentType: row.documentType,
    status: row.status,
    subjectLabel,
    subjectEmail,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    documentExpiresAt: row.documentExpiresAt?.toISOString() ?? null,
    ibanNumber: row.ibanNumber,
    rejectionReason: row.rejectionReason,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    expiryWarning: getKycExpiryWarning(row.documentExpiresAt),
    updateRequestedAt: row.updateRequestedAt?.toISOString() ?? null,
    updateRequestMessage: row.updateRequestMessage ?? null,
  };
}

export async function listAdminKycDocuments(params: {
  tab?: KycTab;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AdminKycDocumentDto>> {
  const tab = params.tab ?? "pending";
  const { page, pageSize, skip, take } = normalizePagination(params);
  const statuses = tabToStatuses(tab);

  const where = { status: { in: statuses } };

  const [total, rows] = await Promise.all([
    prisma.kycDocument.count({ where }),
    prisma.kycDocument.findMany({
      where,
      orderBy: tab === "pending" ? { submittedAt: "asc" } : { reviewedAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { name: true, email: true } },
        vendor: { select: { storeName: true, owner: { select: { email: true } } } },
      },
    }),
  ]);

  const items: AdminKycDocumentDto[] = [];
  for (const row of rows) {
    const { subjectLabel, subjectEmail } = resolveSubjectLabel(row);
    items.push(mapAdminRow(row, subjectLabel, subjectEmail));
  }

  return buildPaginatedResult(items, total, page, pageSize);
}

const CUSTOMER_SCOPE_TYPES: KycSubjectType[] = ["CUSTOMER", "AFFILIATE"];

function ensureSubjectGroup(
  groups: Map<string, AdminKycSubjectGroupDto>,
  row: {
    subjectKey: string;
    subjectType: KycSubjectType;
  },
  subjectLabel: string,
  subjectEmail: string | null,
): AdminKycSubjectGroupDto {
  const existing = groups.get(row.subjectKey);
  if (existing) return existing;
  const group: AdminKycSubjectGroupDto = {
    subjectKey: row.subjectKey,
    subjectType: row.subjectType,
    subjectLabel,
    subjectEmail,
    documents: [],
  };
  groups.set(row.subjectKey, group);
  return group;
}

export async function listAdminKycSubjectGroups(params: {
  scope: AdminKycScopeTab;
  search?: string;
}): Promise<AdminKycSubjectGroupDto[]> {
  const subjectTypes = params.scope === "vendor" ? (["VENDOR"] as KycSubjectType[]) : CUSTOMER_SCOPE_TYPES;
  const search = params.search?.trim().toLowerCase() ?? "";

  const rows = await prisma.kycDocument.findMany({
    where: { subjectType: { in: subjectTypes } },
    orderBy: [{ subjectKey: "asc" }, { documentType: "asc" }],
    include: {
      user: { select: { name: true, email: true } },
      vendor: { select: { storeName: true, owner: { select: { email: true } } } },
    },
  });

  const groups = new Map<string, AdminKycSubjectGroupDto>();

  for (const row of rows) {
    const { subjectLabel, subjectEmail } = resolveSubjectLabel(row);
    if (search) {
      const haystack = `${subjectLabel} ${subjectEmail ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) continue;
    }

    const group = ensureSubjectGroup(groups, row, subjectLabel, subjectEmail);
    if (row.status === "UPLOADED") continue;

    group.documents.push(mapAdminRow(row, subjectLabel, subjectEmail));
  }

  return [...groups.values()]
    .filter((group) => group.documents.length > 0)
    .sort((a, b) => a.subjectLabel.localeCompare(b.subjectLabel));
}

export async function requestAdminKycDocumentUpdate(params: {
  documentIds: string[];
  adminUserId: string;
  message?: string;
}): Promise<number> {
  if (params.documentIds.length === 0) return 0;
  const message = params.message?.trim() || null;
  const now = new Date();

  const result = await prisma.kycDocument.updateMany({
    where: {
      id: { in: params.documentIds },
      status: { not: "UPLOADED" },
    },
    data: {
      updateRequestedAt: now,
      updateRequestMessage: message,
      updateRequestedByUserId: params.adminUserId,
    },
  });

  return result.count;
}

export async function reviewAdminKycDocument(params: {
  documentId: string;
  reviewerUserId: string;
  action: "accept" | "reject";
  rejectionReason?: string;
}): Promise<AdminKycDocumentDto> {
  const row = await prisma.kycDocument.findUnique({
    where: { id: params.documentId },
    include: {
      user: { select: { name: true, email: true } },
      vendor: { select: { storeName: true, owner: { select: { email: true } } } },
    },
  });
  if (!row) throw new AdminKycError("NOT_FOUND");
  if (row.status !== "PENDING_REVIEW") throw new AdminKycError("NOT_PENDING");

  if (params.action === "reject" && !params.rejectionReason?.trim()) {
    throw new AdminKycError("INVALID_ACTION", "Rejection reason is required.");
  }

  const updated = await prisma.kycDocument.update({
    where: { id: row.id },
    data:
      params.action === "accept"
        ? {
            status: "ACCEPTED",
            rejectionReason: null,
            reviewedByUserId: params.reviewerUserId,
            reviewedAt: new Date(),
            updateRequestedAt: null,
            updateRequestMessage: null,
            updateRequestedByUserId: null,
          }
        : {
            status: "REJECTED",
            rejectionReason: params.rejectionReason?.trim() ?? null,
            reviewedByUserId: params.reviewerUserId,
            reviewedAt: new Date(),
          },
    include: {
      user: { select: { name: true, email: true } },
      vendor: { select: { storeName: true, owner: { select: { email: true } } } },
    },
  });

  const { subjectLabel, subjectEmail } = resolveSubjectLabel(updated);
  return mapAdminRow(updated, subjectLabel, subjectEmail);
}

export async function getAdminKycDocumentFileMeta(documentId: string): Promise<{
  storageKey: string;
  mimeType: string;
  originalFileName: string;
}> {
  const row = await prisma.kycDocument.findUnique({
    where: { id: documentId },
    select: { storageKey: true, mimeType: true, originalFileName: true, status: true },
  });
  if (!row) throw new KycDocumentError("NOT_FOUND");
  if (row.status === "UPLOADED") {
    throw new AdminKycError(
      "DRAFT_NOT_SUBMITTED",
      "This document has not been submitted for review yet.",
    );
  }
  return row;
}

export async function countPendingKycDocuments(): Promise<number> {
  return prisma.kycDocument.count({ where: { status: "PENDING_REVIEW" } });
}
