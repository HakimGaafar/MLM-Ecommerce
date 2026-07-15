import type { VendorShippingChangeRequestInput } from "@mlm/shared";
import { defaultShippingFeeForMode, SHIPPING_FEE_DIRECT_SAR } from "@mlm/shared";
import type { VendorIndirectFulfillment, VendorShippingMode } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";

export class VendorShippingError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "PENDING_REQUEST_EXISTS"
      | "PROFILE_NOT_APPROVED"
      | "INVALID_MODE"
      | "NOT_FOUND_REQUEST",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorShippingError";
  }
}

export type VendorShippingProfileDto = {
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  shippingFee: string;
  shippingNotes: string | null;
  profileStatus: "PENDING_APPROVAL" | "APPROVED";
  shippingApprovedAt: string | null;
  feeSetByAdmin: boolean;
  pendingRequest: {
    id: string;
    requestedMode: VendorShippingMode;
    requestedIndirect: VendorIndirectFulfillment | null;
    requestedFee: string;
    requestedNotes: string | null;
    createdAt: string;
  } | null;
};

const vendorShippingSelect = {
  id: true,
  shippingMode: true,
  indirectFulfillment: true,
  shippingFee: true,
  shippingNotes: true,
  shippingProfileStatus: true,
  shippingApprovedAt: true,
  shippingFeeSetByAdmin: true,
  shippingSetupAt: true,
} as const;

async function loadPendingRequest(vendorId: string) {
  return prisma.vendorShippingChangeRequest.findFirst({
    where: { vendorId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requestedMode: true,
      requestedIndirect: true,
      requestedFee: true,
      requestedNotes: true,
      createdAt: true,
    },
  });
}

function toProfileDto(
  vendor: {
    shippingMode: VendorShippingMode;
    indirectFulfillment: VendorIndirectFulfillment | null;
    shippingFee: Prisma.Decimal | null;
    shippingNotes: string | null;
    shippingProfileStatus: "PENDING_APPROVAL" | "APPROVED";
    shippingApprovedAt: Date | null;
    shippingFeeSetByAdmin: boolean;
  },
  pending: Awaited<ReturnType<typeof loadPendingRequest>>,
): VendorShippingProfileDto {
  const fee =
    vendor.shippingFee?.toString() ??
    defaultShippingFeeForMode(
      vendor.shippingMode,
      vendor.indirectFulfillment ?? undefined,
    );

  return {
    shippingMode: vendor.shippingMode,
    indirectFulfillment: vendor.indirectFulfillment,
    shippingFee: fee,
    shippingNotes: vendor.shippingNotes,
    profileStatus: vendor.shippingProfileStatus,
    shippingApprovedAt: vendor.shippingApprovedAt?.toISOString() ?? null,
    feeSetByAdmin: vendor.shippingFeeSetByAdmin,
    pendingRequest: pending
      ? {
          id: pending.id,
          requestedMode: pending.requestedMode,
          requestedIndirect: pending.requestedIndirect,
          requestedFee: pending.requestedFee.toString(),
          requestedNotes: pending.requestedNotes,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
  };
}

export async function getVendorShippingProfile(vendorId: string): Promise<VendorShippingProfileDto | null> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: vendorShippingSelect,
  });
  if (!vendor) return null;
  const pending = await loadPendingRequest(vendorId);
  return toProfileDto(vendor, pending);
}

export async function isVendorShippingApproved(vendorId: string): Promise<boolean> {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: { shippingProfileStatus: true },
  });
  return row?.shippingProfileStatus === "APPROVED";
}

export async function assertVendorShippingApproved(vendorId: string): Promise<void> {
  const ok = await isVendorShippingApproved(vendorId);
  if (!ok) {
    throw new VendorShippingError(
      "PROFILE_NOT_APPROVED",
      "Shipping profile must be approved before publishing products.",
    );
  }
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    vendorId: string;
    actorType: "ADMIN" | "VENDOR_REQUEST_APPROVED" | "SYSTEM";
    actorUserId?: string | null;
    previousMode: VendorShippingMode | null;
    newMode: VendorShippingMode;
    previousIndirect: VendorIndirectFulfillment | null;
    newIndirect: VendorIndirectFulfillment | null;
    previousFee: Prisma.Decimal | null;
    newFee: Prisma.Decimal;
    note?: string | null;
  },
) {
  await tx.vendorShippingAuditLog.create({
    data: {
      vendorId: params.vendorId,
      actorType: params.actorType,
      actorUserId: params.actorUserId ?? null,
      previousMode: params.previousMode,
      newMode: params.newMode,
      previousIndirect: params.previousIndirect,
      newIndirect: params.newIndirect,
      previousFee: params.previousFee,
      newFee: params.newFee,
      note: params.note ?? null,
    },
  });
}

export async function submitVendorShippingChangeRequest(
  vendorId: string,
  input: VendorShippingChangeRequestInput,
): Promise<VendorShippingProfileDto> {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: vendorShippingSelect,
  });
  if (!vendor) throw new VendorShippingError("NOT_FOUND", "Vendor not found.");

  const existingPending = await prisma.vendorShippingChangeRequest.findFirst({
    where: { vendorId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    throw new VendorShippingError("PENDING_REQUEST_EXISTS", "A shipping change request is already pending review.");
  }

  const requestedFee = new Prisma.Decimal(input.shippingFee.toFixed(2));
  const indirect =
    input.shippingMode === "INDIRECT" ? (input.indirectFulfillment as VendorIndirectFulfillment) : null;

  await prisma.$transaction(async (tx) => {
    await tx.vendorShippingChangeRequest.create({
      data: {
        vendorId,
        requestedMode: input.shippingMode,
        requestedIndirect: indirect,
        requestedFee,
        requestedNotes: input.shippingNotes ?? null,
        status: "PENDING",
      },
    });

    await tx.vendor.update({
      where: { id: vendorId },
      data: {
        shippingNotes: input.shippingNotes ?? vendor.shippingNotes,
        shippingSetupAt: vendor.shippingSetupAt ?? new Date(),
      },
    });
  });

  const profile = await getVendorShippingProfile(vendorId);
  if (!profile) throw new VendorShippingError("NOT_FOUND");
  return profile;
}

export async function applyApprovedShippingToVendor(
  tx: Prisma.TransactionClient,
  params: {
    vendorId: string;
    mode: VendorShippingMode;
    indirect: VendorIndirectFulfillment | null;
    fee: Prisma.Decimal;
    notes?: string | null;
    actorType: "ADMIN" | "VENDOR_REQUEST_APPROVED";
    actorUserId?: string | null;
    note?: string | null;
    setByAdmin: boolean;
  },
) {
  const before = await tx.vendor.findUnique({
    where: { id: params.vendorId },
    select: {
      shippingMode: true,
      indirectFulfillment: true,
      shippingFee: true,
    },
  });
  if (!before) throw new VendorShippingError("NOT_FOUND");

  await tx.vendor.update({
    where: { id: params.vendorId },
    data: {
      shippingMode: params.mode,
      indirectFulfillment: params.indirect,
      shippingFee: params.fee,
      defaultShippingFee: params.fee,
      shippingNotes: params.notes ?? undefined,
      shippingProfileStatus: "APPROVED",
      shippingApprovedAt: new Date(),
      shippingFeeSetByAdmin: params.setByAdmin,
      shippingSetupAt: new Date(),
    },
  });

  await writeAuditLog(tx, {
    vendorId: params.vendorId,
    actorType: params.actorType,
    actorUserId: params.actorUserId,
    previousMode: before.shippingMode,
    newMode: params.mode,
    previousIndirect: before.indirectFulfillment,
    newIndirect: params.indirect,
    previousFee: before.shippingFee,
    newFee: params.fee,
    note: params.note,
  });
}

export async function initializeVendorShippingProposal(
  vendorId: string,
  shippingNotes: string,
): Promise<VendorShippingProfileDto> {
  return submitVendorShippingChangeRequest(vendorId, {
    shippingMode: "DIRECT",
    indirectFulfillment: null,
    shippingFee: Number.parseFloat(SHIPPING_FEE_DIRECT_SAR),
    shippingNotes,
  });
}
