import type { CouponDiscountType } from "@mlm/shared";
import { Prisma, prisma } from "@mlm/db";

export class CouponCheckoutError extends Error {
  constructor(
    public readonly code:
      | "INVALID_COUPON"
      | "COUPON_USAGE_EXCEEDED"
      | "COUPON_VENDOR_MISMATCH"
      | "COUPON_CURRENCY_MISMATCH",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CouponCheckoutError";
  }
}

export type CartLineForCoupon = {
  vendorId: string;
  lineTotal: Prisma.Decimal;
  currency: string;
};

export type CouponCheckoutResult = {
  couponId: string;
  couponCode: string;
  vendorId: string;
  vendorName: string;
  discountType: CouponDiscountType;
  discountValue: string;
  discountTotal: Prisma.Decimal;
};

export type CouponsCheckoutResolution = {
  code: string;
  applications: CouponCheckoutResult[];
  discountTotal: Prisma.Decimal;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

type CouponRow = {
  id: string;
  vendorId: string;
  code: string;
  discountType: string;
  discountValue: Prisma.Decimal;
  currency: string;
  usageLimit: number | null;
  usedCount: number;
  vendor: { storeName: string };
};

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function activeCouponDateFilter(now: Date) {
  return {
    status: "ACTIVE" as const,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

function roundDecimal2(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal((Math.round(Number(value) * 100) / 100).toFixed(2));
}

function computeDiscountForCoupon(
  coupon: CouponRow,
  lines: CartLineForCoupon[],
): Prisma.Decimal {
  const vendorSubtotal = lines
    .filter((l) => l.vendorId === coupon.vendorId)
    .reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0));

  if (vendorSubtotal.lte(0)) {
    return new Prisma.Decimal(0);
  }

  let discountTotal: Prisma.Decimal;
  if (coupon.discountType === "PERCENT") {
    discountTotal = vendorSubtotal.mul(
      new Prisma.Decimal(coupon.discountValue.toString()).div(100),
    );
  } else {
    const fixed = new Prisma.Decimal(coupon.discountValue.toString());
    discountTotal = fixed.gt(vendorSubtotal) ? vendorSubtotal : fixed;
  }

  return roundDecimal2(discountTotal);
}

function toCouponCheckoutResult(coupon: CouponRow, discountTotal: Prisma.Decimal): CouponCheckoutResult {
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    vendorId: coupon.vendorId,
    vendorName: coupon.vendor.storeName,
    discountType: coupon.discountType as CouponDiscountType,
    discountValue: coupon.discountValue.toString(),
    discountTotal,
  };
}

/**
 * Resolve a coupon code against cart lines. Applies to every matching vendor in the cart.
 */
export async function resolveCouponsForCheckout(
  couponCode: string,
  lines: CartLineForCoupon[],
  db: DbClient = prisma,
): Promise<CouponsCheckoutResolution> {
  const code = normalizeCouponCode(couponCode);
  if (code.length < 3) {
    throw new CouponCheckoutError("INVALID_COUPON", "Coupon code is invalid.");
  }

  if (lines.length === 0) {
    throw new CouponCheckoutError("COUPON_VENDOR_MISMATCH", "Cart is empty.");
  }

  const currency = lines[0].currency;
  const vendorIdsInCart = [...new Set(lines.map((l) => l.vendorId))];
  const now = new Date();

  const coupons = await db.coupon.findMany({
    where: {
      code,
      vendorId: { in: vendorIdsInCart },
      ...activeCouponDateFilter(now),
    },
    include: { vendor: { select: { storeName: true } } },
  });

  if (coupons.length === 0) {
    throw new CouponCheckoutError("INVALID_COUPON", "Coupon code is not valid for this cart.");
  }

  const applications: CouponCheckoutResult[] = [];

  for (const coupon of coupons) {
    if (coupon.currency !== currency) {
      throw new CouponCheckoutError(
        "COUPON_CURRENCY_MISMATCH",
        `Coupon for ${coupon.vendor.storeName} does not match the cart currency.`,
      );
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new CouponCheckoutError(
        "COUPON_USAGE_EXCEEDED",
        `Coupon for ${coupon.vendor.storeName} has reached its usage limit.`,
      );
    }

    const discountTotal = computeDiscountForCoupon(coupon, lines);
    if (discountTotal.lte(0)) continue;

    applications.push(toCouponCheckoutResult(coupon, discountTotal));
  }

  if (applications.length === 0) {
    throw new CouponCheckoutError("COUPON_VENDOR_MISMATCH", "Coupon does not apply to items in your cart.");
  }

  const discountTotal = applications.reduce(
    (sum, app) => sum.add(app.discountTotal),
    new Prisma.Decimal(0),
  );

  return {
    code,
    applications,
    discountTotal: roundDecimal2(discountTotal),
  };
}

/** @deprecated Use resolveCouponsForCheckout — returns first application only. */
export async function resolveCouponForCheckout(
  couponCode: string,
  lines: CartLineForCoupon[],
  db: DbClient = prisma,
): Promise<CouponCheckoutResult> {
  const resolved = await resolveCouponsForCheckout(couponCode, lines, db);
  return resolved.applications[0];
}

/** Atomically consume one coupon use; throws if limit reached between quote and order. */
export async function incrementCouponUsedCount(
  couponId: string,
  db: DbClient,
): Promise<void> {
  const row = await db.coupon.findUnique({
    where: { id: couponId },
    select: { usageLimit: true, usedCount: true },
  });
  if (!row) {
    throw new CouponCheckoutError("INVALID_COUPON", "Coupon no longer exists.");
  }
  if (row.usageLimit != null && row.usedCount >= row.usageLimit) {
    throw new CouponCheckoutError("COUPON_USAGE_EXCEEDED", "This coupon has reached its usage limit.");
  }
  await db.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });
}

export async function incrementCouponUsedCounts(
  couponIds: string[],
  db: DbClient,
): Promise<void> {
  for (const couponId of couponIds) {
    await incrementCouponUsedCount(couponId, db);
  }
}
