import type { ProductFulfillmentType, VendorIndirectFulfillment, VendorShippingMode } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import {
  defaultFulfillmentFromVendorProfile,
  defaultShippingFeeForFulfillmentType,
  fulfillmentTypeToVendorShipping,
  type ProductFulfillmentTypeCode,
} from "@mlm/shared";

export type CartLineForShipping = {
  vendorId: string;
  fulfillmentType: ProductFulfillmentTypeCode;
};

export type ResolvedVendorShippingLine = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentType;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  fee: Prisma.Decimal;
};

type VendorShippingRow = {
  id: string;
  storeName: string;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  shippingFee: Prisma.Decimal | null;
  shippingProfileStatus: "PENDING_APPROVAL" | "APPROVED";
  defaultShippingFee: Prisma.Decimal | null;
};

export function groupCartLinesForShipping(lines: CartLineForShipping[]): CartLineForShipping[] {
  const seen = new Set<string>();
  const grouped: CartLineForShipping[] = [];
  for (const line of lines) {
    const key = `${line.vendorId}:${line.fulfillmentType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    grouped.push(line);
  }
  return grouped;
}

export function resolveFeeForFulfillmentLine(
  vendor: VendorShippingRow,
  fulfillmentType: ProductFulfillmentTypeCode,
): Prisma.Decimal {
  if (vendor.shippingProfileStatus === "APPROVED" && vendor.shippingFee != null) {
    const primary = defaultFulfillmentFromVendorProfile(
      vendor.shippingMode,
      vendor.indirectFulfillment ?? undefined,
    );
    if (fulfillmentType === primary) {
      return new Prisma.Decimal(vendor.shippingFee.toString());
    }
  }
  if (vendor.defaultShippingFee != null && vendor.shippingProfileStatus === "APPROVED") {
    const primary = defaultFulfillmentFromVendorProfile(
      vendor.shippingMode,
      vendor.indirectFulfillment ?? undefined,
    );
    if (fulfillmentType === primary) {
      return new Prisma.Decimal(vendor.defaultShippingFee.toString());
    }
  }
  return new Prisma.Decimal(defaultShippingFeeForFulfillmentType(fulfillmentType));
}

export async function resolveShippingForCheckout(
  lines: CartLineForShipping[],
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ResolvedVendorShippingLine[]> {
  const grouped = groupCartLinesForShipping(lines);
  if (grouped.length === 0) return [];

  const vendorIds = [...new Set(grouped.map((line) => line.vendorId))];
  const vendors = await db.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      storeName: true,
      shippingMode: true,
      indirectFulfillment: true,
      shippingFee: true,
      shippingProfileStatus: true,
      defaultShippingFee: true,
    },
  });

  const byId = new Map(vendors.map((v) => [v.id, v]));
  const resolved: ResolvedVendorShippingLine[] = [];

  for (const line of grouped) {
    const vendor = byId.get(line.vendorId);
    const snapshot = fulfillmentTypeToVendorShipping(line.fulfillmentType);
    if (!vendor) {
      resolved.push({
        vendorId: line.vendorId,
        vendorName: "Vendor",
        fulfillmentType: line.fulfillmentType,
        shippingMode: snapshot.shippingMode,
        indirectFulfillment: snapshot.indirectFulfillment,
        fee: new Prisma.Decimal(defaultShippingFeeForFulfillmentType(line.fulfillmentType)),
      });
      continue;
    }

    resolved.push({
      vendorId: vendor.id,
      vendorName: vendor.storeName,
      fulfillmentType: line.fulfillmentType,
      shippingMode: snapshot.shippingMode,
      indirectFulfillment: snapshot.indirectFulfillment,
      fee: resolveFeeForFulfillmentLine(vendor, line.fulfillmentType),
    });
  }

  return resolved;
}

export function sumVendorShippingFees(lines: ResolvedVendorShippingLine[]): Prisma.Decimal {
  return lines.reduce((sum, line) => sum.add(line.fee), new Prisma.Decimal(0));
}

export type CheckoutShippingBreakdownDto = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  fee: string;
};

export function shippingBreakdownToDto(lines: ResolvedVendorShippingLine[]): CheckoutShippingBreakdownDto[] {
  return lines.map((line) => ({
    vendorId: line.vendorId,
    vendorName: line.vendorName,
    fulfillmentType: line.fulfillmentType,
    shippingMode: line.shippingMode,
    indirectFulfillment: line.indirectFulfillment,
    fee: line.fee.toFixed(2),
  }));
}
