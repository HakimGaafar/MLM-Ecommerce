import { prisma } from "@mlm/db";
import { getKycStatusSummary } from "../kyc/kyc-document.service";
import { getVendorSetup } from "./vendor-setup.service";

export class MerchantGateError extends Error {
  constructor(
    public readonly code:
      | "STORE_NOT_APPROVED"
      | "SETUP_INCOMPLETE"
      | "KYC_INCOMPLETE"
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
  canSell: boolean;
  blockers: string[];
};

export async function getMerchantReadiness(vendorId: string): Promise<MerchantReadinessDto | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      storeApprovalStatus: true,
      storeApprovedAt: true,
      storeApprovalNote: true,
    },
  });
  if (!vendor) return null;

  const [setup, kyc] = await Promise.all([
    getVendorSetup(vendorId),
    getKycStatusSummary({ subjectType: "VENDOR", vendorId }),
  ]);

  const setupComplete = Boolean(setup && setup.completedCount >= setup.totalSteps);
  const storeApproved = vendor.storeApprovalStatus === "APPROVED";
  const kycApproved = kyc.approved;

  const blockers: string[] = [];
  if (!setupComplete) blockers.push("SETUP_INCOMPLETE");
  if (!kycApproved) blockers.push("KYC_INCOMPLETE");
  if (!storeApproved) blockers.push("STORE_NOT_APPROVED");

  return {
    storeApprovalStatus: vendor.storeApprovalStatus,
    storeApprovedAt: vendor.storeApprovedAt?.toISOString() ?? null,
    storeApprovalNote: vendor.storeApprovalNote,
    setupComplete,
    setupCompletedCount: setup?.completedCount ?? 0,
    setupTotalSteps: setup?.totalSteps ?? 3,
    kycApproved,
    canSell: blockers.length === 0,
    blockers,
  };
}

/** Gate product create / submit until setup, vendor KYC, and admin store approval are done. */
export async function assertMerchantCanSell(vendorId: string): Promise<void> {
  const readiness = await getMerchantReadiness(vendorId);
  if (!readiness) {
    throw new MerchantGateError("VENDOR_NOT_FOUND", "Store not found.");
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
}

export function isPublicVendorApproved(status: string): boolean {
  return status === "APPROVED";
}
