import type { VendorStoreApprovalStatus } from "@prisma/client";
import { prisma } from "@mlm/db";
import { getMerchantReadiness } from "../vendor/vendor-merchant-gate.service";

export type AdminVendorListItemDto = {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  storeApprovalStatus: VendorStoreApprovalStatus;
  setupComplete: boolean;
  kycApproved: boolean;
  canSell: boolean;
  createdAt: string;
};

export class AdminVendorStoreError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "INVALID_STATUS" | "NOT_READY",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminVendorStoreError";
  }
}

async function toAdminVendorItem(vendorId: string): Promise<AdminVendorListItemDto | null> {
  const row = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { products: true } },
    },
  });
  if (!row) return null;
  const readiness = await getMerchantReadiness(row.id);
  return {
    id: row.id,
    storeName: row.storeName,
    ownerName: row.owner.name,
    ownerEmail: row.owner.email,
    productCount: row._count.products,
    storeApprovalStatus: row.storeApprovalStatus,
    setupComplete: readiness?.setupComplete ?? false,
    kycApproved: readiness?.kycApproved ?? false,
    canSell: readiness?.canSell ?? false,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminVendors(params: {
  page: number;
  pageSize: number;
  marketId: string;
}): Promise<{
  items: AdminVendorListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where: { marketId: params.marketId },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      select: { id: true },
    }),
    prisma.vendor.count({ where: { marketId: params.marketId } }),
  ]);

  const items = (
    await Promise.all(rows.map((v) => toAdminVendorItem(v.id)))
  ).filter((item): item is AdminVendorListItemDto => item != null);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

export async function setVendorStoreApproval(params: {
  vendorId: string;
  status: VendorStoreApprovalStatus;
  adminUserId: string;
  note?: string | null;
}): Promise<AdminVendorListItemDto> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.vendorId },
    select: { id: true },
  });
  if (!vendor) throw new AdminVendorStoreError("NOT_FOUND", "Vendor not found.");

  if (params.status === "APPROVED") {
    const readiness = await getMerchantReadiness(params.vendorId);
    if (!readiness?.setupComplete || !readiness.kycApproved) {
      throw new AdminVendorStoreError(
        "NOT_READY",
        "Store setup and vendor KYC must be complete before approval.",
      );
    }
  }

  const now = new Date();
  await prisma.vendor.update({
    where: { id: params.vendorId },
    data: {
      storeApprovalStatus: params.status,
      storeApprovalNote: params.note?.trim() || null,
      storeApprovedByUserId: params.adminUserId,
      storeApprovedAt: params.status === "APPROVED" ? now : null,
    },
  });

  const item = await toAdminVendorItem(params.vendorId);
  if (!item) throw new AdminVendorStoreError("NOT_FOUND", "Vendor not found.");
  return item;
}
