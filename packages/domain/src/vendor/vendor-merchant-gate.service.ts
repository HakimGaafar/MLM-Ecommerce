import { prisma } from "@mlm/db";
import { getKycStatusSummary } from "../kyc/kyc-document.service";
import { getPendingMarketReaccept } from "../markets/market-go-live.service";
import { getVendorSetup } from "./vendor-setup.service";

export class MerchantGateError extends Error {
  constructor(
    public readonly code:
      | "STORE_NOT_APPROVED"
      | "SETUP_INCOMPLETE"
      | "KYC_INCOMPLETE"
      | "SETTLEMENT_RISK_REQUIRED"
      | "MARKET_REACCEPT_REQUIRED"
      | "VENDOR_NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "MerchantGateError";
  }
}

export type MerchantReadinessDto = {
  storeApprovalStatus: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  storeApprovedAt: string | null;
  storeApprovalNote: string | null;
  setupComplete: boolean;
  setupCompletedCount: number;
  setupTotalSteps: number;
  kycApproved: boolean;
  settlementRiskConsented: boolean;
  marketReacceptRequired: boolean;
  pendingMarketReacceptCode: string | null;
  canSell: boolean;
  blockers: string[];
};

export async function getMerchantReadiness(vendorId: string): Promise<MerchantReadinessDto | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      ownerUserId: true,
      storeApprovalStatus: true,
      storeApprovedAt: true,
      storeApprovalNote: true,
      settlementRiskConsentAt: true,
    },
  });
  if (!vendor) return null;

  const [setup, kyc, pendingReaccept] = await Promise.all([
    getVendorSetup(vendorId),
    getKycStatusSummary({ subjectType: "VENDOR", vendorId }),
    getPendingMarketReaccept(vendor.ownerUserId),
  ]);

  const setupComplete = Boolean(setup && setup.completedCount >= setup.totalSteps);
  const storeApproved = vendor.storeApprovalStatus === "APPROVED";
  const kycApproved = kyc.approved;
  const settlementRiskConsented = Boolean(vendor.settlementRiskConsentAt);
  const marketReacceptRequired = Boolean(pendingReaccept);

  const blockers: string[] = [];
  if (marketReacceptRequired) blockers.push("MARKET_REACCEPT_REQUIRED");
  if (!setupComplete) blockers.push("SETUP_INCOMPLETE");
  if (!kycApproved) blockers.push("KYC_INCOMPLETE");
  if (!storeApproved) blockers.push("STORE_NOT_APPROVED");
  if (!settlementRiskConsented) blockers.push("SETTLEMENT_RISK_REQUIRED");

  return {
    storeApprovalStatus: vendor.storeApprovalStatus,
    storeApprovedAt: vendor.storeApprovedAt?.toISOString() ?? null,
    storeApprovalNote: vendor.storeApprovalNote,
    setupComplete,
    setupCompletedCount: setup?.completedCount ?? 0,
    setupTotalSteps: setup?.totalSteps ?? 3,
    kycApproved,
    settlementRiskConsented,
    marketReacceptRequired,
    pendingMarketReacceptCode: pendingReaccept?.marketCode ?? null,
    canSell: blockers.length === 0,
    blockers,
  };
}

/** Gate product create / submit until setup, KYC, store approval, and settlement-risk consent. */
export async function assertMerchantCanSell(vendorId: string): Promise<void> {
  const readiness = await getMerchantReadiness(vendorId);
  if (!readiness) {
    throw new MerchantGateError("VENDOR_NOT_FOUND", "Store not found.");
  }
  if (readiness.marketReacceptRequired) {
    throw new MerchantGateError(
      "MARKET_REACCEPT_REQUIRED",
      "Your home market is now live. Re-accept the merchant policies before selling.",
    );
  }
  if (!readiness.setupComplete) {
    throw new MerchantGateError(
      "SETUP_INCOMPLETE",
      "Complete store setup (branding, shipping approval, and payout) before adding products.",
    );
  }
  if (!readiness.kycApproved) {
    throw new MerchantGateError(
      "KYC_INCOMPLETE",
      "Complete vendor identity verification before adding products.",
    );
  }
  if (readiness.storeApprovalStatus !== "APPROVED") {
    throw new MerchantGateError(
      "STORE_NOT_APPROVED",
      "Your store must be approved by the platform before you can add products.",
    );
  }
  if (!readiness.settlementRiskConsented) {
    throw new MerchantGateError(
      "SETTLEMENT_RISK_REQUIRED",
      "Accept FX, transfer fee, and customs risk terms in Store settings before adding products.",
    );
  }
}

export function isPublicVendorApproved(status: string): boolean {
  return status === "APPROVED";
}
