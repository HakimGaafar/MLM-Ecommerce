import type {
  CouponDiscountType,
  CouponListTab,
  CouponStatus,
  PaginatedResult,
  PlatformCouponCreateInput,
  PlatformCouponUpdateInput,
} from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import type { CouponDiscountType as DbDiscountType, CouponStatus as DbCouponStatus } from "@mlm/db";
import { prisma } from "@mlm/db";

export type PlatformCouponDto = {
  id: string;
  marketId: string;
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

export class PlatformCouponError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "DUPLICATE_CODE" | "INVALID_STATUS_TRANSITION" | "MARKET_NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PlatformCouponError";
  }
}

function resolveEffectiveStatus(row: {
  status: DbCouponStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}): CouponStatus {
  const now = Date.now();
  if (row.status === "SUSPENDED") return "SUSPENDED";
  if (row.status === "TERMINATED") return "TERMINATED";
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
  marketId: string;
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
}): PlatformCouponDto {
  return {
    id: row.id,
    marketId: row.marketId,
    code: row.code,
    description: row.description,
    discountType: row.discountType as CouponDiscountType,
    discountValue: row.discountValue.toString(),
    currency: row.currency,
    status: row.status as CouponStatus,
    effectiveStatus: resolveEffectiveStatus(row),
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
  if (tab === "SUSPENDED") return { status: "SUSPENDED" as const };
  if (tab === "TERMINATED") return { status: "TERMINATED" as const };
  return {
    OR: [{ status: "EXPIRED" as const }, { endsAt: { lt: now }, status: "ACTIVE" as const }],
  };
}

function assertStatusTransition(current: CouponStatus, next: CouponStatus): void {
  if (current === next) return;
  const allowed: Partial<Record<CouponStatus, CouponStatus[]>> = {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["SUSPENDED", "TERMINATED"],
    SUSPENDED: ["ACTIVE", "TERMINATED"],
    TERMINATED: [],
    EXPIRED: [],
  };
  if (!(allowed[current]?.includes(next) ?? false)) {
    throw new PlatformCouponError("INVALID_STATUS_TRANSITION", "That status change is not allowed.");
  }
}

export async function listPlatformCoupons(params: {
  marketId: string;
  tab?: CouponListTab;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<PlatformCouponDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { marketId: params.marketId, ...tabWhere(params.tab) };
  const [rows, total] = await prisma.$transaction([
    prisma.platformCoupon.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.platformCoupon.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(toDto), total, page, pageSize);
}

export async function createPlatformCoupon(
  marketId: string,
  input: PlatformCouponCreateInput,
): Promise<PlatformCouponDto> {
  const market = await prisma.market.findUnique({ where: { id: marketId }, select: { id: true, defaultCurrency: true } });
  if (!market) {
    throw new PlatformCouponError("MARKET_NOT_FOUND", "Market not found.");
  }

  const dup = await prisma.platformCoupon.findFirst({
    where: { marketId, code: input.code },
    select: { id: true },
  });
  if (dup) {
    throw new PlatformCouponError("DUPLICATE_CODE", "A platform coupon with this code already exists.");
  }

  const row = await prisma.platformCoupon.create({
    data: {
      marketId,
      code: input.code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      currency: input.currency ?? market.defaultCurrency,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      usageLimit: input.usageLimit ?? null,
    },
  });
  return toDto(row);
}

export async function updatePlatformCoupon(
  marketId: string,
  couponId: string,
  input: PlatformCouponUpdateInput,
): Promise<PlatformCouponDto> {
  const existing = await prisma.platformCoupon.findFirst({ where: { id: couponId, marketId } });
  if (!existing) {
    throw new PlatformCouponError("NOT_FOUND", "Platform coupon not found.");
  }

  if (input.status) {
    assertStatusTransition(existing.status as CouponStatus, input.status);
  }

  if (existing.status !== "DRAFT") {
    const touchingFields =
      input.description !== undefined ||
      input.discountType !== undefined ||
      input.discountValue !== undefined ||
      input.currency !== undefined ||
      input.startsAt !== undefined ||
      input.endsAt !== undefined ||
      input.usageLimit !== undefined;
    if (touchingFields) {
      throw new PlatformCouponError(
        "INVALID_STATUS_TRANSITION",
        "Activated coupons can only be suspended or terminated.",
      );
    }
  }

  const row = await prisma.platformCoupon.update({
    where: { id: couponId },
    data: {
      ...(existing.status === "DRAFT" && input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(existing.status === "DRAFT" && input.discountType
        ? { discountType: input.discountType }
        : {}),
      ...(existing.status === "DRAFT" && input.discountValue != null
        ? { discountValue: input.discountValue }
        : {}),
      ...(existing.status === "DRAFT" && input.currency ? { currency: input.currency } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(existing.status === "DRAFT" && input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(existing.status === "DRAFT" && input.endsAt !== undefined
        ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
        : {}),
      ...(existing.status === "DRAFT" && input.usageLimit !== undefined
        ? { usageLimit: input.usageLimit }
        : {}),
    },
  });
  return toDto(row);
}

export async function deletePlatformCoupon(marketId: string, couponId: string): Promise<void> {
  const existing = await prisma.platformCoupon.findFirst({ where: { id: couponId, marketId } });
  if (!existing) {
    throw new PlatformCouponError("NOT_FOUND", "Platform coupon not found.");
  }
  if (existing.status !== "DRAFT") {
    throw new PlatformCouponError("INVALID_STATUS_TRANSITION", "Only draft coupons can be deleted.");
  }
  await prisma.platformCoupon.delete({ where: { id: couponId } });
}
