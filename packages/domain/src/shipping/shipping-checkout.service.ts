import type { ProductFulfillmentType, VendorIndirectFulfillment, VendorShippingMode } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import {
  defaultFulfillmentFromVendorProfile,
  defaultShippingFeeForFulfillmentType,
  fulfillmentTypeToVendorShipping,
  inferShippingPackageType,
  type ProductFulfillmentTypeCode,
  type ProductStockLocationCode,
  type ShippingPackageTypeCode,
} from "@mlm/shared";

export type CartLineForShipping = {
  vendorId: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  stockLocation?: ProductStockLocationCode;
  warehouseId?: string | null;
  warehouseCountry?: string | null;
  merchantCountry?: string | null;
  customerCountry?: string | null;
};

export type ResolvedVendorShippingLine = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentType;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  fee: Prisma.Decimal;
  packageType?: ShippingPackageTypeCode;
  packageKey?: string;
};

type VendorShippingRow = {
  id: string;
  storeName: string;
  countryCode: string;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  shippingFee: Prisma.Decimal | null;
  shippingProfileStatus: "PENDING_APPROVAL" | "APPROVED";
  defaultShippingFee: Prisma.Decimal | null;
};

export function packageKeyForLine(line: CartLineForShipping): string {
  const stock = line.stockLocation ?? "MERCHANT";
  if (stock === "FOURCES_WAREHOUSE") {
    return `fources:${line.warehouseId ?? line.warehouseCountry ?? "unknown"}`;
  }
  return `merchant:${line.vendorId}`;
}

function packageTypeForLine(line: CartLineForShipping): ShippingPackageTypeCode {
  const stock = line.stockLocation ?? "MERCHANT";
  return inferShippingPackageType({
    stockLocation: stock,
    warehouseCountry: line.warehouseCountry,
    customerCountry: line.customerCountry,
    merchantCountry: line.merchantCountry,
  });
}

function fulfillmentFromPackage(stock: ProductStockLocationCode): ProductFulfillmentTypeCode {
  return stock === "FOURCES_WAREHOUSE" ? "FORSEIZ_STOCK" : "DIRECT";
}

/** Group cart lines into shipping packages (FOURCES warehouse or merchant). */
export function groupCartLinesForShipping(lines: CartLineForShipping[]): CartLineForShipping[] {
  const seen = new Set<string>();
  const grouped: CartLineForShipping[] = [];
  for (const line of lines) {
    const key = packageKeyForLine(line);
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
      countryCode: true,
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
    const stock = line.stockLocation ?? "MERCHANT";
    const fulfillmentType = line.fulfillmentType ?? fulfillmentFromPackage(stock);
    const snapshot = fulfillmentTypeToVendorShipping(fulfillmentType);
    const pkgType = packageTypeForLine({
      ...line,
      merchantCountry: line.merchantCountry ?? vendor?.countryCode,
    });
    const pkgKey = packageKeyForLine(line);

    if (!vendor) {
      resolved.push({
        vendorId: line.vendorId,
        vendorName: "Vendor",
        fulfillmentType,
        shippingMode: snapshot.shippingMode,
        indirectFulfillment: snapshot.indirectFulfillment,
        fee: new Prisma.Decimal(defaultShippingFeeForFulfillmentType(fulfillmentType)),
        packageType: pkgType,
        packageKey: pkgKey,
      });
      continue;
    }

    resolved.push({
      vendorId: vendor.id,
      vendorName: vendor.storeName,
      fulfillmentType,
      shippingMode: snapshot.shippingMode,
      indirectFulfillment: snapshot.indirectFulfillment,
      fee: resolveFeeForFulfillmentLine(vendor, fulfillmentType),
      packageType: pkgType,
      packageKey: pkgKey,
    });
  }

  return resolved;
}

export function sumShippingFees(lines: ResolvedVendorShippingLine[]): Prisma.Decimal {
  return lines.reduce(
    (sum, line) => sum.add(line.fee),
    new Prisma.Decimal(0),
  );
}

/** @deprecated Prefer sumShippingFees — kept for checkout callers. */
export const sumVendorShippingFees = sumShippingFees;

export type CheckoutShippingBreakdownDto = {
  vendorId: string;
  vendorName: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  shippingMode: VendorShippingMode;
  indirectFulfillment: VendorIndirectFulfillment | null;
  fee: string;
  packageType?: ShippingPackageTypeCode;
  packageKey?: string;
};

export function shippingBreakdownToDto(
  lines: ResolvedVendorShippingLine[],
): CheckoutShippingBreakdownDto[] {
  return lines.map((line) => ({
    vendorId: line.vendorId,
    vendorName: line.vendorName,
    fulfillmentType: line.fulfillmentType,
    shippingMode: line.shippingMode,
    indirectFulfillment: line.indirectFulfillment,
    fee: line.fee.toFixed(2),
    packageType: line.packageType,
    packageKey: line.packageKey,
  }));
}
