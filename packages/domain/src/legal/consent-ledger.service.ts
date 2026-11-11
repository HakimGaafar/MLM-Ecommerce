import { prisma, type Prisma } from "@mlm/db";
import {
  CUSTOMER_CHECKOUT_DOCUMENT_TYPES,
  CUSTOMER_SIGNUP_DOCUMENT_TYPES,
  DEFAULT_LEGAL_POLICY_VERSION,
  MERCHANT_REGISTRATION_DOCUMENT_TYPES,
  type ConsentContext,
  type LegalDocumentType,
} from "@mlm/shared";

export type ConsentAcceptanceInput = {
  documentType: LegalDocumentType;
  policyVersion: string;
};

export type RecordConsentsParams = {
  userId: string;
  marketId: string;
  context: ConsentContext;
  acceptances: ConsentAcceptanceInput[];
  vendorId?: string | null;
  orderId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
};

async function resolveCurrentPolicyVersion(
  marketId: string,
  documentType: LegalDocumentType,
  db: Prisma.TransactionClient | typeof prisma,
): Promise<string> {
  const row = await db.legalPolicyVersion.findFirst({
    where: { marketId, documentType, isCurrent: true },
    select: { version: true },
  });
  return row?.version ?? DEFAULT_LEGAL_POLICY_VERSION;
}

export async function resolvePolicyVersionsForTypes(params: {
  marketId: string;
  documentTypes: readonly LegalDocumentType[];
}): Promise<Record<LegalDocumentType, string>> {
  const rows = await prisma.legalPolicyVersion.findMany({
    where: {
      marketId: params.marketId,
      documentType: { in: [...params.documentTypes] },
      isCurrent: true,
    },
    select: { documentType: true, version: true },
  });
  const byType = new Map(rows.map((r) => [r.documentType as LegalDocumentType, r.version]));
  const out = {} as Record<LegalDocumentType, string>;
  for (const documentType of params.documentTypes) {
    out[documentType] = byType.get(documentType) ?? DEFAULT_LEGAL_POLICY_VERSION;
  }
  return out;
}

export async function recordPolicyConsents(params: RecordConsentsParams): Promise<number> {
  if (params.acceptances.length === 0) return 0;
  const db = params.tx ?? prisma;
  const acceptedAt = new Date();
  const data = params.acceptances.map((item) => ({
    userId: params.userId,
    marketId: params.marketId,
    documentType: item.documentType,
    policyVersion: item.policyVersion.trim() || DEFAULT_LEGAL_POLICY_VERSION,
    context: params.context,
    vendorId: params.vendorId ?? null,
    orderId: params.orderId ?? null,
    ipAddress: params.ipAddress?.slice(0, 64) || null,
    userAgent: params.userAgent?.slice(0, 512) || null,
    acceptedAt,
  }));
  const result = await db.consentRecord.createMany({ data });
  return result.count;
}

/** Record consents using each document's current market version. */
export async function recordCurrentPolicyConsents(params: {
  userId: string;
  marketId: string;
  context: ConsentContext;
  documentTypes: readonly LegalDocumentType[];
  vendorId?: string | null;
  orderId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  const db = params.tx ?? prisma;
  const acceptances: ConsentAcceptanceInput[] = [];
  for (const documentType of params.documentTypes) {
    const policyVersion = await resolveCurrentPolicyVersion(params.marketId, documentType, db);
    acceptances.push({ documentType, policyVersion });
  }
  return recordPolicyConsents({
    userId: params.userId,
    marketId: params.marketId,
    context: params.context,
    acceptances,
    vendorId: params.vendorId,
    orderId: params.orderId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    tx: params.tx,
  });
}

export function assertRequiredDocumentTypesAccepted(params: {
  acceptedTypes: readonly LegalDocumentType[];
  requiredTypes: readonly LegalDocumentType[];
}): void {
  const set = new Set(params.acceptedTypes);
  for (const required of params.requiredTypes) {
    if (!set.has(required)) {
      const err = new Error("CONSENT_REQUIRED");
      err.name = "ConsentRequiredError";
      throw err;
    }
  }
}

export async function hasVendorOnboardingConsents(params: {
  userId: string;
  vendorId: string;
  marketId: string;
}): Promise<boolean> {
  const rows = await prisma.consentRecord.findMany({
    where: {
      userId: params.userId,
      vendorId: params.vendorId,
      marketId: params.marketId,
      context: "VENDOR_ONBOARDING",
      documentType: { in: [...MERCHANT_REGISTRATION_DOCUMENT_TYPES] },
    },
    select: { documentType: true },
    distinct: ["documentType"],
  });
  const have = new Set(rows.map((r) => r.documentType));
  return MERCHANT_REGISTRATION_DOCUMENT_TYPES.every((t) => have.has(t));
}

export {
  CUSTOMER_SIGNUP_DOCUMENT_TYPES,
  CUSTOMER_CHECKOUT_DOCUMENT_TYPES,
  MERCHANT_REGISTRATION_DOCUMENT_TYPES,
};
