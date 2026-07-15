import type { VendorSetupBrandingInput, VendorSetupPayoutInput, VendorSetupShippingInput } from "@mlm/shared";
import { prisma } from "@mlm/db";
import { getVendorShippingProfile, submitVendorShippingChangeRequest } from "./vendor-shipping.service";

export type VendorSetupStepDto = {
  id: "branding" | "shipping" | "payout";
  complete: boolean;
};

export type VendorSetupDto = {
  steps: VendorSetupStepDto[];
  completedCount: number;
  totalSteps: number;
  branding: { logoUrl: string | null; bannerUrl: string | null };
  shipping: {
    shippingNotes: string | null;
    shippingMode: "DIRECT" | "INDIRECT";
    indirectFulfillment: "FORSEIZ_STOCK" | "ON_ORDER" | null;
    shippingFee: string | null;
    profileStatus: "PENDING_APPROVAL" | "APPROVED";
    feeSetByAdmin: boolean;
    pendingRequest: boolean;
    shippingSetupAt: string | null;
  };
  payout: {
    payoutAccountHolder: string | null;
    payoutIbanMasked: string | null;
    payoutSetupAt: string | null;
  };
};

function maskIban(iban: string | null): string | null {
  if (!iban) return null;
  if (iban.length <= 8) return iban;
  return `${iban.slice(0, 4)}…${iban.slice(-4)}`;
}

function buildSetup(row: {
  logoUrl: string | null;
  bannerUrl: string | null;
  shippingNotes: string | null;
  shippingMode: "DIRECT" | "INDIRECT";
  indirectFulfillment: "FORSEIZ_STOCK" | "ON_ORDER" | null;
  shippingFee: { toString(): string } | null;
  shippingProfileStatus: "PENDING_APPROVAL" | "APPROVED";
  shippingFeeSetByAdmin: boolean;
  shippingSetupAt: Date | null;
  payoutAccountHolder: string | null;
  payoutIban: string | null;
  payoutSetupAt: Date | null;
  pendingRequest: boolean;
}): VendorSetupDto {
  const brandingComplete = Boolean(row.logoUrl?.trim() && row.bannerUrl?.trim());
  const shippingComplete = row.shippingProfileStatus === "APPROVED";
  const payoutComplete = Boolean(row.payoutSetupAt);

  const steps: VendorSetupStepDto[] = [
    { id: "branding", complete: brandingComplete },
    { id: "shipping", complete: shippingComplete },
    { id: "payout", complete: payoutComplete },
  ];

  return {
    steps,
    completedCount: steps.filter((s) => s.complete).length,
    totalSteps: steps.length,
    branding: { logoUrl: row.logoUrl, bannerUrl: row.bannerUrl },
    shipping: {
      shippingNotes: row.shippingNotes,
      shippingMode: row.shippingMode,
      indirectFulfillment: row.indirectFulfillment,
      shippingFee: row.shippingFee?.toString() ?? null,
      profileStatus: row.shippingProfileStatus,
      feeSetByAdmin: row.shippingFeeSetByAdmin,
      pendingRequest: row.pendingRequest,
      shippingSetupAt: row.shippingSetupAt?.toISOString() ?? null,
    },
    payout: {
      payoutAccountHolder: row.payoutAccountHolder,
      payoutIbanMasked: maskIban(row.payoutIban),
      payoutSetupAt: row.payoutSetupAt?.toISOString() ?? null,
    },
  };
}

const setupSelect = {
  logoUrl: true,
  bannerUrl: true,
  shippingNotes: true,
  shippingMode: true,
  indirectFulfillment: true,
  shippingFee: true,
  shippingProfileStatus: true,
  shippingFeeSetByAdmin: true,
  shippingSetupAt: true,
  payoutAccountHolder: true,
  payoutIban: true,
  payoutSetupAt: true,
} as const;

async function loadSetupRow(vendorId: string) {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: setupSelect,
  });
  if (!row) return null;
  const pending = await prisma.vendorShippingChangeRequest.findFirst({
    where: { vendorId, status: "PENDING" },
    select: { id: true },
  });
  return buildSetup({ ...row, pendingRequest: Boolean(pending) });
}

export async function getVendorSetup(vendorId: string): Promise<VendorSetupDto | null> {
  return loadSetupRow(vendorId);
}

export async function updateVendorSetupBranding(
  vendorId: string,
  input: VendorSetupBrandingInput,
): Promise<VendorSetupDto | null> {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ?? null } : {}),
      ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl ?? null } : {}),
    },
  });
  return loadSetupRow(vendorId);
}

export async function updateVendorSetupShipping(
  vendorId: string,
  input: VendorSetupShippingInput,
): Promise<VendorSetupDto | null> {
  await submitVendorShippingChangeRequest(vendorId, {
    shippingMode: input.shippingMode,
    indirectFulfillment: input.indirectFulfillment ?? null,
    shippingFee: input.shippingFee,
    shippingNotes: input.shippingNotes,
  });
  return loadSetupRow(vendorId);
}

export async function updateVendorSetupPayout(
  vendorId: string,
  input: VendorSetupPayoutInput,
): Promise<VendorSetupDto | null> {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      payoutAccountHolder: input.payoutAccountHolder,
      payoutIban: input.payoutIban.toUpperCase(),
      payoutSetupAt: new Date(),
    },
  });
  return loadSetupRow(vendorId);
}
