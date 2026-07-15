import type {
  CouponDiscountType,
  CouponListTab,
  CouponStatus,
  PaginatedResult,
  VendorCouponCreateInput,
  VendorCouponUpdateInput,
} from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import type { CouponDiscountType as DbDiscountType, CouponStatus as DbCouponStatus } from "@mlm/db";
import { prisma } from "@mlm/db";

export type VendorCouponDto = {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: string;
  currency: string;
  status: CouponStatus;
  effectiveStatus: CouponStatus;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

export class VendorCouponError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "DUPLICATE_CODE" | "INVALID_STATUS_TRANSITION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorCouponError";
  }
}

function resolveEffectiveStatus(row: {
  status: DbCouponStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}): CouponStatus {
  const now = Date.now();
  if (row.status === "EXPIRED") return "EXPIRED";
  if (row.endsAt && row.endsAt.getTime() < now) return "EXPIRED";
  if (row.status === "ACTIVE") {
    if (row.startsAt && row.startsAt.getTime() > now) return "DRAFT";
    return "ACTIVE";
  }
  return row.status as CouponStatus;
}

function toDto(row: {
  id: string;
  code: string;
  description: string | null;
  discountType: DbDiscountType;
  discountValue: { toString(): string };
  currency: string;
  status: DbCouponStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  createdAt: Date;
  updatedAt: Date;
}): VendorCouponDto {
  const effectiveStatus = resolveEffectiveStatus(row);
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType as CouponDiscountType,
    discountValue: row.discountValue.toString(),
    currency: row.currency,
    status: row.status as CouponStatus,
    effectiveStatus,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function tabWhere(tab: CouponListTab | undefined) {
  const now = new Date();
  if (!tab || tab === "ALL") return {};
  if (tab === "DRAFT") {
    return {
      OR: [
        { status: "DRAFT" as const },
        { status: "ACTIVE" as const, startsAt: { gt: now } },
      ],
    };
  }
  if (tab === "ACTIVE") {
    return {
      status: "ACTIVE" as const,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
  }
  return {
    OR: [{ status: "EXPIRED" as const }, { endsAt: { lt: now } }],
  };
}

function assertStatusTransition(current: CouponStatus, next: CouponStatus): void {
  if (current === next) return;
  const allowed: Partial<Record<CouponStatus, CouponStatus[]>> = {
    DRAFT: ["ACTIVE", "EXPIRED"],
    ACTIVE: ["EXPIRED"],
    EXPIRED: [],
  };
  if (!(allowed[current]?.includes(next) ?? false)) {
    throw new VendorCouponError("INVALID_STATUS_TRANSITION", "That status change is not allowed.");
  }
}

export async function listVendorCoupons(
  vendorId: string,
  params?: { tab?: CouponListTab; page?: number; pageSize?: number },
): Promise<PaginatedResult<VendorCouponDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { vendorId, ...tabWhere(params?.tab) };
  const [rows, total] = await prisma.$transaction([
    prisma.coupon.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(toDto), total, page, pageSize);
}

export async function getVendorCoupon(vendorId: string, couponId: string): Promise<VendorCouponDto | null> {
  const row = await prisma.coupon.findFirst({ where: { id: couponId, vendorId } });
  return row ? toDto(row) : null;
}

export async function createVendorCoupon(
  vendorId: string,
  input: VendorCouponCreateInput,
): Promise<VendorCouponDto> {
  const dup = await prisma.coupon.findFirst({
    where: { vendorId, code: input.code },
    select: { id: true },
  });
  if (dup) {
    throw new VendorCouponError("DUPLICATE_CODE", "A coupon with this code already exists.");
  }

  const row = await prisma.coupon.create({
    data: {
      vendorId,
      code: input.code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      currency: input.currency ?? "SAR",
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      usageLimit: input.usageLimit ?? null,
    },
  });
  return toDto(row);
}

export async function updateVendorCoupon(
  vendorId: string,
  couponId: string,
  input: VendorCouponUpdateInput,
): Promise<VendorCouponDto> {
  const existing = await prisma.coupon.findFirst({ where: { id: couponId, vendorId } });
  if (!existing) {
    throw new VendorCouponError("NOT_FOUND", "Coupon not found.");
  }

  if (input.status) {
    assertStatusTransition(existing.status as CouponStatus, input.status);
  }

  const row = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.discountType ? { discountType: input.discountType } : {}),
      ...(input.discountValue != null ? { discountValue: input.discountValue } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      ...(input.usageLimit !== undefined ? { usageLimit: input.usageLimit } : {}),
    },
  });
  return toDto(row);
}

export async function deleteVendorCoupon(vendorId: string, couponId: string): Promise<void> {
  const existing = await prisma.coupon.findFirst({ where: { id: couponId, vendorId } });
  if (!existing) {
    throw new VendorCouponError("NOT_FOUND", "Coupon not found.");
  }
  if (existing.status !== "DRAFT") {
    throw new VendorCouponError("INVALID_STATUS_TRANSITION", "Only draft coupons can be deleted.");
  }
  await prisma.coupon.delete({ where: { id: couponId } });
}
