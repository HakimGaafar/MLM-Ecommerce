import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import {
  MARKET_IDS,
  slugifyStoreName,
  type VendorOnboardingAccountInput,
} from "@mlm/shared";
import { resolvePrimaryMarketIdForCountry } from "../markets/market-go-live.service";
import { verifyTurnstileToken, TurnstileError } from "../security/turnstile.service";
import {
  createStoreForExistingUser,
  onboardNewSeller,
  SellerOnboardError,
} from "../seller/seller-onboarding.service";

export { TurnstileError, SellerOnboardError };

export const VENDOR_ONBOARDING_PAGES = [
  "account",
  "personal",
  "legal",
  "store",
  "financial",
  "review",
] as const;

export type VendorOnboardingPageKey = (typeof VENDOR_ONBOARDING_PAGES)[number];

export function onboardingStepIndex(pageKey: VendorOnboardingPageKey): number {
  return VENDOR_ONBOARDING_PAGES.indexOf(pageKey) + 1;
}

export async function getVendorOnboardingState(ownerUserId: string, marketId: string) {
  return prisma.vendor.findUnique({
    where: { ownerUserId_marketId: { ownerUserId, marketId } },
    select: {
      id: true,
      onboardingStatus: true,
      onboardingStep: true,
      onboardingSubmittedAt: true,
      storeApprovalStatus: true,
      storeName: true,
      storeNameOther: true,
      slug: true,
      repNameEn: true,
      repNameOther: true,
      legalNameEn: true,
      legalNameOther: true,
      storeDescriptionEn: true,
      storeDescriptionOther: true,
      entityType: true,
      shortBusinessNote: true,
      contactPhone: true,
      countryCode: true,
      addressLine1: true,
      addressLine2: true,
      state: true,
      city: true,
      postalCode: true,
      invoiceVatTrn: true,
      invoiceVatPercent: true,
      payoutIban: true,
      payoutAccountHolder: true,
      logoUrl: true,
      bannerUrl: true,
      commissionTermsAcceptedAt: true,
      crossMarketTermsAcceptedAt: true,
      about: true,
    },
  });
}

/** Page 1 — creates user + vendor draft (UNDER_REGISTRATION). */
export async function startVendorOnboardingAccount(params: {
  input: VendorOnboardingAccountInput;
  marketId: string;
  remoteIp?: string | null;
  userAgent?: string | null;
}) {
  await verifyTurnstileToken({
    token: params.input.turnstileToken,
    remoteIp: params.remoteIp,
  });

  const {
    assertRequiredDocumentTypesAccepted,
    recordCurrentPolicyConsents,
    MERCHANT_REGISTRATION_DOCUMENT_TYPES,
  } = await import("../legal/consent-ledger.service");
  try {
    assertRequiredDocumentTypesAccepted({
      acceptedTypes: params.input.acceptedDocumentTypes as never[],
      requiredTypes: MERCHANT_REGISTRATION_DOCUMENT_TYPES,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONSENT_REQUIRED") {
      throw new SellerOnboardError("VALIDATION", "Accept all merchant registration policies to continue.");
    }
    throw e;
  }

  let slug = slugifyStoreName(params.input.storeName);
  if (slug.length < 3) slug = `store-${Date.now().toString(36)}`.slice(0, 48);

  const result = await onboardNewSeller(
    {
      name: params.input.repNameEn,
      email: params.input.email,
      username: params.input.username,
      password: params.input.password,
      confirmPassword: params.input.confirmPassword,
      storeName: params.input.storeName,
      slug,
      countryCode: "SA",
      addressLine1: "To be completed",
      city: "To be completed",
      postalCode: "00000",
      about: params.input.shortBusinessNote || "",
      planCode: "FREE",
      acceptPlan: true,
      referralCode: params.input.referralCode || "",
    },
    params.marketId,
  );

  await prisma.vendor.update({
    where: { id: result.vendorId },
    data: {
      onboardingStatus: "UNDER_REGISTRATION",
      onboardingStep: 2,
      repNameEn: params.input.repNameEn,
      repNameOther: params.input.repNameOther || null,
      contactPhone: params.input.phone,
      shortBusinessNote: params.input.shortBusinessNote || null,
      commissionTermsAcceptedAt: new Date(),
      primaryMarketId: MARKET_IDS.SA,
    },
  });

  await recordCurrentPolicyConsents({
    userId: result.userId,
    marketId: params.marketId,
    context: "VENDOR_ONBOARDING",
    documentTypes: MERCHANT_REGISTRATION_DOCUMENT_TYPES,
    vendorId: result.vendorId,
    ipAddress: params.remoteIp,
    userAgent: params.userAgent,
  });

  return result;
}

/** Logged-in customer/merchant starts the wizard without re-creating an account. */
export async function startVendorOnboardingForExistingUser(params: {
  userId: string;
  marketId: string;
  storeName: string;
  phone: string;
  repNameEn: string;
  repNameOther?: string;
  shortBusinessNote?: string;
  acceptCommissionTerms: true;
  acceptedDocumentTypes: string[];
  remoteIp?: string | null;
  userAgent?: string | null;
}) {
  const {
    assertRequiredDocumentTypesAccepted,
    recordCurrentPolicyConsents,
    MERCHANT_REGISTRATION_DOCUMENT_TYPES,
  } = await import("../legal/consent-ledger.service");
  try {
    assertRequiredDocumentTypesAccepted({
      acceptedTypes: params.acceptedDocumentTypes as never[],
      requiredTypes: MERCHANT_REGISTRATION_DOCUMENT_TYPES,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONSENT_REQUIRED") {
      throw new SellerOnboardError("VALIDATION", "Accept all merchant registration policies to continue.");
    }
    throw e;
  }

  let slug = slugifyStoreName(params.storeName);
  if (slug.length < 3) slug = `store-${Date.now().toString(36)}`.slice(0, 48);

  const result = await createStoreForExistingUser(
    params.userId,
    {
      storeName: params.storeName,
      slug,
      countryCode: "SA",
      addressLine1: "To be completed",
      city: "To be completed",
      postalCode: "00000",
      about: params.shortBusinessNote || "",
      planCode: "FREE",
    },
    params.marketId,
  );

  await prisma.vendor.update({
    where: { id: result.vendorId },
    data: {
      onboardingStatus: "UNDER_REGISTRATION",
      onboardingStep: 2,
      repNameEn: params.repNameEn,
      repNameOther: params.repNameOther || null,
      contactPhone: params.phone,
      shortBusinessNote: params.shortBusinessNote || null,
      commissionTermsAcceptedAt: new Date(),
      primaryMarketId: MARKET_IDS.SA,
    },
  });

  await recordCurrentPolicyConsents({
    userId: params.userId,
    marketId: params.marketId,
    context: "VENDOR_ONBOARDING",
    documentTypes: MERCHANT_REGISTRATION_DOCUMENT_TYPES,
    vendorId: result.vendorId,
    ipAddress: params.remoteIp,
    userAgent: params.userAgent,
  });

  return result;
}

export async function advanceVendorOnboardingStep(params: {
  vendorId: string;
  ownerUserId: string;
  step: number;
  data: Record<string, unknown>;
}) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: params.vendorId, ownerUserId: params.ownerUserId },
    select: { id: true, onboardingStatus: true, marketId: true },
  });
  if (!vendor) throw new SellerOnboardError("FORBIDDEN", "Vendor not found.");
  if (vendor.onboardingStatus === "ACTIVE") {
    throw new SellerOnboardError("FORBIDDEN", "Vendor is already active.");
  }

  const patch: Record<string, unknown> = {
    onboardingStep: Math.min(Math.max(params.step, 1), 6),
  };

  const d = params.data;
  if (typeof d.repNameEn === "string") patch.repNameEn = d.repNameEn;
  if (typeof d.repNameOther === "string") patch.repNameOther = d.repNameOther || null;
  if (typeof d.fullNameEn === "string") patch.repNameEn = d.fullNameEn;
  if (typeof d.fullNameOther === "string") patch.repNameOther = d.fullNameOther || null;
  if (typeof d.phone === "string") patch.contactPhone = d.phone;
  if (typeof d.legalNameEn === "string") {
    patch.legalNameEn = d.legalNameEn;
    patch.invoiceLegalName = d.legalNameEn;
  }
  if (typeof d.legalNameOther === "string") patch.legalNameOther = d.legalNameOther;
  if (typeof d.entityType === "string") patch.entityType = d.entityType;
  if (typeof d.storeName === "string") patch.storeName = d.storeName;
  if (typeof d.storeNameOther === "string") patch.storeNameOther = d.storeNameOther || null;
  if (typeof d.storeDescriptionEn === "string") patch.storeDescriptionEn = d.storeDescriptionEn;
  if (typeof d.storeDescriptionOther === "string") {
    patch.storeDescriptionOther = d.storeDescriptionOther || null;
  }
  if (typeof d.slug === "string") patch.slug = d.slug;
  if (typeof d.countryCode === "string") {
    patch.countryCode = d.countryCode;
    patch.primaryMarketId = await resolvePrimaryMarketIdForCountry(d.countryCode);
  }
  if (typeof d.street === "string") patch.addressLine1 = d.street;
  if (typeof d.district === "string") patch.addressLine2 = d.district;
  if (typeof d.region === "string") patch.state = d.region;
  if (typeof d.city === "string") patch.city = d.city;
  if (typeof d.postalCode === "string") patch.postalCode = d.postalCode;
  // googleMapsUrl is UX-only (pin fills address fields). Do not write shippingNotes —
  // that column is used by vendor shipping setup.
  if (d.vatRegistered === true && typeof d.vatTrn === "string") patch.invoiceVatTrn = d.vatTrn;
  if (d.vatRegistered === false) patch.invoiceVatTrn = null;
  if (typeof d.vatPercent === "number") patch.invoiceVatPercent = d.vatPercent;
  if (typeof d.payoutIban === "string") patch.payoutIban = d.payoutIban || null;
  if (typeof d.payoutAccountHolder === "string") {
    patch.payoutAccountHolder = d.payoutAccountHolder || null;
  }
  if (d.acceptCrossMarketTerms === true) {
    patch.crossMarketTermsAcceptedAt = new Date();
    patch.settlementRiskConsentAt = new Date();
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: patch as never,
  });

  return getVendorOnboardingState(params.ownerUserId, vendor.marketId);
}

export async function submitVendorOnboardingForReview(params: {
  vendorId: string;
  ownerUserId: string;
}) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: params.vendorId, ownerUserId: params.ownerUserId },
    select: { id: true, marketId: true },
  });
  if (!vendor) throw new SellerOnboardError("FORBIDDEN", "Vendor not found.");

  const { hasVendorOnboardingConsents } = await import("../legal/consent-ledger.service");
  const consented = await hasVendorOnboardingConsents({
    userId: params.ownerUserId,
    vendorId: vendor.id,
    marketId: vendor.marketId,
  });
  if (!consented) {
    throw new SellerOnboardError(
      "VALIDATION",
      "Accept all merchant registration policies before submitting for review.",
    );
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      onboardingStatus: "UNDER_REVIEW",
      onboardingStep: 6,
      onboardingSubmittedAt: new Date(),
      storeApprovalStatus: "PENDING",
    },
  });

  return { status: "UNDER_REVIEW" as const };
}

export async function setOnboardingFieldDecision(params: {
  vendorId: string;
  pageKey: string;
  fieldKey: string;
  decision: "ACCEPTED" | "NEEDS_FIX" | "PENDING";
  note?: string | null;
  actorUserId: string;
}) {
  // Accepting one language name field also accepts its pair (Phase 0 lock).
  const paired = params.fieldKey.endsWith("En")
    ? params.fieldKey.replace(/En$/, "Other")
    : params.fieldKey.endsWith("Other")
      ? params.fieldKey.replace(/Other$/, "En")
      : null;
  const keys = paired ? [params.fieldKey, paired] : [params.fieldKey];

  for (const fieldKey of keys) {
    await raceSafeUpsert({
      upsert: () =>
        prisma.vendorOnboardingFieldReview.upsert({
          where: {
            vendorId_pageKey_fieldKey: {
              vendorId: params.vendorId,
              pageKey: params.pageKey,
              fieldKey,
            },
          },
          create: {
            vendorId: params.vendorId,
            pageKey: params.pageKey,
            fieldKey,
            decision: params.decision,
            note: params.note ?? null,
            decidedByUserId: params.actorUserId,
            decidedAt: new Date(),
          },
          update: {
            decision: params.decision,
            note: params.note ?? null,
            decidedByUserId: params.actorUserId,
            decidedAt: new Date(),
          },
        }),
      findUnique: () =>
        prisma.vendorOnboardingFieldReview.findUnique({
          where: {
            vendorId_pageKey_fieldKey: {
              vendorId: params.vendorId,
              pageKey: params.pageKey,
              fieldKey,
            },
          },
        }),
    });
  }
}

export async function approveVendorOnboarding(params: {
  vendorId: string;
  actorUserId: string;
  note?: string | null;
}) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    select: { id: true, ownerUserId: true, marketId: true },
  });
  if (!vendor) throw new SellerOnboardError("FORBIDDEN", "Vendor not found.");

  const { hasVendorOnboardingConsents } = await import("../legal/consent-ledger.service");
  const consented = await hasVendorOnboardingConsents({
    userId: vendor.ownerUserId,
    vendorId: vendor.id,
    marketId: vendor.marketId,
  });
  if (!consented) {
    throw new SellerOnboardError(
      "VALIDATION",
      "Vendor must accept all registration policies before activation.",
    );
  }

  await prisma.vendor.update({
    where: { id: params.vendorId },
    data: {
      onboardingStatus: "ACTIVE",
      storeApprovalStatus: "APPROVED",
      storeApprovedAt: new Date(),
      storeApprovedByUserId: params.actorUserId,
      storeApprovalNote: params.note?.trim() || null,
    },
  });
}

export async function rejectVendorOnboarding(params: {
  vendorId: string;
  actorUserId: string;
  note?: string | null;
}) {
  await prisma.vendor.update({
    where: { id: params.vendorId },
    data: {
      onboardingStatus: "UNDER_REGISTRATION",
      storeApprovalStatus: "REJECTED",
      storeApprovedAt: null,
      storeApprovedByUserId: params.actorUserId,
      storeApprovalNote: params.note?.trim() || null,
      onboardingSubmittedAt: null,
    },
  });
}

export async function listOnboardingFieldReviews(vendorId: string) {
  return prisma.vendorOnboardingFieldReview.findMany({
    where: { vendorId },
    orderBy: [{ pageKey: "asc" }, { fieldKey: "asc" }],
  });
}

export async function listVendorsUnderOnboardingReview(params: {
  marketId: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;
  const where = {
    marketId: params.marketId,
    onboardingStatus: "UNDER_REVIEW" as const,
  };
  const [rows, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      orderBy: { onboardingSubmittedAt: "asc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        storeName: true,
        slug: true,
        onboardingStatus: true,
        onboardingStep: true,
        onboardingSubmittedAt: true,
        storeApprovalStatus: true,
        owner: { select: { name: true, email: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      storeName: r.storeName,
      slug: r.slug,
      onboardingStatus: r.onboardingStatus,
      onboardingStep: r.onboardingStep,
      onboardingSubmittedAt: r.onboardingSubmittedAt?.toISOString() ?? null,
      storeApprovalStatus: r.storeApprovalStatus,
      ownerName: r.owner.name,
      ownerEmail: r.owner.email,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAdminVendorOnboardingDetail(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      marketId: true,
      onboardingStatus: true,
      onboardingStep: true,
      onboardingSubmittedAt: true,
      storeApprovalStatus: true,
      storeName: true,
      storeNameOther: true,
      slug: true,
      repNameEn: true,
      repNameOther: true,
      legalNameEn: true,
      legalNameOther: true,
      storeDescriptionEn: true,
      storeDescriptionOther: true,
      entityType: true,
      shortBusinessNote: true,
      contactPhone: true,
      countryCode: true,
      addressLine1: true,
      addressLine2: true,
      state: true,
      city: true,
      postalCode: true,
      invoiceVatTrn: true,
      invoiceVatPercent: true,
      payoutIban: true,
      payoutAccountHolder: true,
      commissionTermsAcceptedAt: true,
      crossMarketTermsAcceptedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!vendor) return null;
  const fieldReviews = await listOnboardingFieldReviews(vendorId);
  const profileChangeRequests = await prisma.vendorProfileChangeRequest.findMany({
    where: { vendorId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return { vendor, fieldReviews, profileChangeRequests };
}

/** After ACTIVE — vendor proposes profile edits; status returns to UNDER_REVIEW. */
export async function submitVendorProfileChangeRequest(params: {
  vendorId: string;
  ownerUserId: string;
  proposed: Record<string, unknown>;
  vendorNote?: string | null;
}) {
  const vendor = await prisma.vendor.findFirst({
    where: { id: params.vendorId, ownerUserId: params.ownerUserId },
    select: { id: true, onboardingStatus: true },
  });
  if (!vendor) throw new SellerOnboardError("FORBIDDEN", "Vendor not found.");
  if (vendor.onboardingStatus !== "ACTIVE") {
    throw new SellerOnboardError("FORBIDDEN", "Profile changes require an active store.");
  }

  const pending = await prisma.vendorProfileChangeRequest.findFirst({
    where: { vendorId: vendor.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    throw new SellerOnboardError("VALIDATION", "A profile change request is already pending.");
  }

  const [request] = await prisma.$transaction([
    prisma.vendorProfileChangeRequest.create({
      data: {
        vendorId: vendor.id,
        proposedJson: params.proposed as Prisma.InputJsonValue,
        vendorNote: params.vendorNote?.trim() || null,
        status: "PENDING",
      },
    }),
    prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        onboardingStatus: "UNDER_REVIEW",
        storeApprovalStatus: "PENDING",
        onboardingSubmittedAt: new Date(),
      },
    }),
  ]);

  return request;
}

export async function reviewVendorProfileChangeRequest(params: {
  requestId: string;
  actorUserId: string;
  action: "approve" | "reject";
  adminNote?: string | null;
}) {
  const req = await prisma.vendorProfileChangeRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!req || req.status !== "PENDING") {
    throw new SellerOnboardError("VALIDATION", "Change request not found or already reviewed.");
  }

  if (params.action === "reject") {
    await prisma.$transaction([
      prisma.vendorProfileChangeRequest.update({
        where: { id: req.id },
        data: {
          status: "REJECTED",
          adminNote: params.adminNote?.trim() || null,
          reviewedByUserId: params.actorUserId,
          reviewedAt: new Date(),
        },
      }),
      prisma.vendor.update({
        where: { id: req.vendorId },
        data: {
          onboardingStatus: "ACTIVE",
          storeApprovalStatus: "APPROVED",
        },
      }),
    ]);
    return { status: "REJECTED" as const };
  }

  const proposed = (req.proposedJson ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) patch[key] = value;
  };
  assign("storeName", proposed.storeName);
  assign("storeNameOther", proposed.storeNameOther ?? null);
  assign("storeDescriptionEn", proposed.storeDescriptionEn);
  assign("storeDescriptionOther", proposed.storeDescriptionOther ?? null);
  assign("repNameEn", proposed.repNameEn);
  assign("repNameOther", proposed.repNameOther ?? null);
  assign("legalNameEn", proposed.legalNameEn);
  assign("legalNameOther", proposed.legalNameOther ?? null);
  assign("contactPhone", proposed.contactPhone);
  assign("payoutIban", proposed.payoutIban ?? null);
  assign("payoutAccountHolder", proposed.payoutAccountHolder ?? null);
  if (typeof proposed.invoiceVatTrn === "string" || proposed.invoiceVatTrn === null) {
    patch.invoiceVatTrn = proposed.invoiceVatTrn;
  }

  await prisma.$transaction([
    prisma.vendor.update({
      where: { id: req.vendorId },
      data: {
        ...patch,
        onboardingStatus: "ACTIVE",
        storeApprovalStatus: "APPROVED",
        storeApprovedAt: new Date(),
        storeApprovedByUserId: params.actorUserId,
      } as never,
    }),
    prisma.vendorProfileChangeRequest.update({
      where: { id: req.id },
      data: {
        status: "APPROVED",
        adminNote: params.adminNote?.trim() || null,
        reviewedByUserId: params.actorUserId,
        reviewedAt: new Date(),
      },
    }),
  ]);

  return { status: "APPROVED" as const };
}

export async function listPendingProfileChangeRequests(vendorId: string) {
  return prisma.vendorProfileChangeRequest.findMany({
    where: { vendorId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}
