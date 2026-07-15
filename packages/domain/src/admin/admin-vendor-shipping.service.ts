import type { AdminShippingRequestReviewInput, AdminVendorShippingSetInput } from "@mlm/shared";
import type { PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import type { VendorIndirectFulfillment, VendorShippingMode } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import { VendorShippingError, applyApprovedShippingToVendor } from "../vendor/vendor-shipping.service";

export type AdminShippingRequestRowDto = {
  id: string;
  vendorId: string;
  storeName: string;
  storeSlug: string;
  requestedMode: VendorShippingMode;
  requestedIndirect: VendorIndirectFulfillment | null;
  requestedFee: string;
  requestedNotes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

function mapRequestRow(r: {
  id: string;
  vendorId: string;
  requestedMode: VendorShippingMode;
  requestedIndirect: VendorIndirectFulfillment | null;
  requestedFee: Prisma.Decimal;
  requestedNotes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  vendor: { storeName: string; slug: string };
  reviewedBy: { name: string } | null;
}): AdminShippingRequestRowDto {
  return {
    id: r.id,
    vendorId: r.vendorId,
    storeName: r.vendor.storeName,
    storeSlug: r.vendor.slug,
    requestedMode: r.requestedMode,
    requestedIndirect: r.requestedIndirect,
    requestedFee: r.requestedFee.toString(),
    requestedNotes: r.requestedNotes,
    status: r.status,
    rejectionReason: r.rejectionReason,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewedByName: r.reviewedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

const requestInclude = {
  vendor: { select: { storeName: true, slug: true } },
  reviewedBy: { select: { name: true } },
} as const;

export async function listAdminShippingRequests(
  tab: "pending" | "approved" | "rejected",
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<AdminShippingRequestRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const statusMap = { pending: "PENDING", approved: "APPROVED", rejected: "REJECTED" } as const;
  const where = { status: statusMap[tab] };

  const [rows, total] = await prisma.$transaction([
    prisma.vendorShippingChangeRequest.findMany({
      where,
      orderBy: tab === "pending" ? { createdAt: "asc" } : { reviewedAt: "desc" },
      skip,
      take,
      include: requestInclude,
    }),
    prisma.vendorShippingChangeRequest.count({ where }),
  ]);

  return buildPaginatedResult(rows.map(mapRequestRow), total, page, pageSize);
}

export async function reviewAdminShippingRequest(
  requestId: string,
  adminUserId: string,
  input: AdminShippingRequestReviewInput,
): Promise<AdminShippingRequestRowDto> {
  const request = await prisma.vendorShippingChangeRequest.findUnique({
    where: { id: requestId },
    include: requestInclude,
  });
  if (!request) throw new VendorShippingError("NOT_FOUND_REQUEST", "Shipping request not found.");
  if (request.status !== "PENDING") {
    throw new VendorShippingError("NOT_FOUND_REQUEST", "Request is no longer pending.");
  }

  if (input.action === "reject") {
    const reason = input.rejectionReason?.trim();
    if (!reason) {
      throw new VendorShippingError("INVALID_MODE", "Rejection reason is required.");
    }
    const updated = await prisma.vendorShippingChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
      include: requestInclude,
    });
    return mapRequestRow(updated);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await applyApprovedShippingToVendor(tx, {
      vendorId: request.vendorId,
      mode: request.requestedMode,
      indirect: request.requestedIndirect,
      fee: request.requestedFee,
      notes: request.requestedNotes,
      actorType: "VENDOR_REQUEST_APPROVED",
      actorUserId: adminUserId,
      note: "Approved vendor shipping change request",
      setByAdmin: false,
    });

    return tx.vendorShippingChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
      include: requestInclude,
    });
  });

  return mapRequestRow(updated);
}

export async function adminSetVendorShipping(
  vendorId: string,
  adminUserId: string,
  input: AdminVendorShippingSetInput,
): Promise<void> {
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId }, select: { id: true } });
  if (!vendor) throw new VendorShippingError("NOT_FOUND", "Vendor not found.");

  const indirect =
    input.shippingMode === "INDIRECT"
      ? (input.indirectFulfillment as VendorIndirectFulfillment)
      : null;
  const fee = new Prisma.Decimal(input.shippingFee.toFixed(2));

  await prisma.$transaction(async (tx) => {
    await applyApprovedShippingToVendor(tx, {
      vendorId,
      mode: input.shippingMode,
      indirect,
      fee,
      notes: input.shippingNotes ?? undefined,
      actorType: "ADMIN",
      actorUserId: adminUserId,
      note: input.note ?? "Set by admin",
      setByAdmin: true,
    });

    await tx.vendorShippingChangeRequest.updateMany({
      where: { vendorId, status: "PENDING" },
      data: {
        status: "REJECTED",
        rejectionReason: "Superseded by admin update",
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      },
    });
  });
}

export type AdminVendorShippingDetailDto = {
  vendorId: string;
  storeName: string;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  shippingFee: string;
  shippingNotes: string | null;
  profileStatus: "PENDING_APPROVAL" | "APPROVED";
  feeSetByAdmin: boolean;
};

export async function getAdminVendorShippingDetail(
  vendorId: string,
): Promise<AdminVendorShippingDetailDto | null> {
  const row = await prisma.vendor.findFirst({
    where: { id: vendorId },
    select: {
      id: true,
      storeName: true,
      shippingMode: true,
      indirectFulfillment: true,
      shippingFee: true,
      shippingNotes: true,
      shippingProfileStatus: true,
      shippingFeeSetByAdmin: true,
    },
  });
  if (!row) return null;
  return {
    vendorId: row.id,
    storeName: row.storeName,
    shippingMode: row.shippingMode,
    indirectFulfillment: row.indirectFulfillment,
    shippingFee: row.shippingFee?.toString() ?? "15.00",
    shippingNotes: row.shippingNotes,
    profileStatus: row.shippingProfileStatus,
    feeSetByAdmin: row.shippingFeeSetByAdmin,
  };
}
