import type { ProductFulfillmentType, VendorIndirectFulfillment, VendorShippingMode } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import {
  fulfillmentTypeToVendorShipping,
  inferShippingPackageType,
  type ProductFulfillmentTypeCode,
  type ProductStockLocationCode,
  type ShippingPackageTypeCode,
  type VendorIndirectFulfillmentCode,
} from "@mlm/shared";
import { resolveShippingRateAmount } from "./shipping-rates.service";

export type CartLineForShipping = {
  vendorId: string;
  fulfillmentType: ProductFulfillmentTypeCode;
  stockLocation?: ProductStockLocationCode;
  warehouseId?: string | null;
  warehouseCountry?: string | null;
  merchantCountry?: string | null;
  customerCountry?: string | null;
  fourcesMode?: VendorIndirectFulfillmentCode | null;
  quantity?: number;
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
};

export function packageKeyForLine(line: CartLineForShipping): string {
  const stock = line.stockLocation ?? "MERCHANT";
  if (stock === "FOURCES_WAREHOUSE") {
    return `fources:${line.warehouseId ?? line.warehouseCountry ?? "unknown"}:${line.fourcesMode ?? "FORSEIZ_STOCK"}`;
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

function fulfillmentFromPackage(
  stock: ProductStockLocationCode,
  fourcesMode?: VendorIndirectFulfillmentCode | null,
): ProductFulfillmentTypeCode {
  if (stock === "FOURCES_WAREHOUSE") {
    return fourcesMode === "ON_ORDER" ? "ON_ORDER" : "FORSEIZ_STOCK";
  }
  return "DIRECT";
}

/** Group cart lines into shipping packages; sum quantities per package. */
export function groupCartLinesForShipping(lines: CartLineForShipping[]): CartLineForShipping[] {
  const byKey = new Map<string, CartLineForShipping>();
  for (const line of lines) {
    const key = packageKeyForLine(line);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...line, quantity: Math.max(1, line.quantity ?? 1) });
      continue;
    }
    existing.quantity = (existing.quantity ?? 0) + Math.max(1, line.quantity ?? 1);
  }
  return [...byKey.values()];
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
    },
  });

  const byId = new Map(vendors.map((v) => [v.id, v]));
  const resolved: ResolvedVendorShippingLine[] = [];

  for (const line of grouped) {
    const vendor = byId.get(line.vendorId);
    const stock = line.stockLocation ?? "MERCHANT";
    const fourcesMode =
      stock === "FOURCES_WAREHOUSE"
        ? (line.fourcesMode ?? (line.fulfillmentType === "ON_ORDER" ? "ON_ORDER" : "FORSEIZ_STOCK"))
        : null;
    const fulfillmentType =
      line.fulfillmentType ?? fulfillmentFromPackage(stock, fourcesMode);
    const snapshot = fulfillmentTypeToVendorShipping(fulfillmentType);
    const pkgType = packageTypeForLine({
      ...line,
      merchantCountry: line.merchantCountry ?? vendor?.countryCode,
    });
    const pkgKey = packageKeyForLine(line);
    const fee = await resolveShippingRateAmount({
      packageType: pkgType,
      fourcesMode,
      quantity: line.quantity ?? 1,
      db,
    });

    resolved.push({
      vendorId: line.vendorId,
      vendorName: vendor?.storeName ?? "Vendor",
      fulfillmentType,
      shippingMode: snapshot.shippingMode,
      indirectFulfillment: snapshot.indirectFulfillment,
      fee,
      packageType: pkgType,
      packageKey: pkgKey,
    });
  }

  return resolved;
}

export function sumShippingFees(lines: ResolvedVendorShippingLine[]): Prisma.Decimal {
  return lines.reduce((sum, line) => sum.add(line.fee), new Prisma.Decimal(0));
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

/** @deprecated Fees come from ShippingRate — kept for older call sites. */
export function resolveFeeForFulfillmentLine(
  _vendor: VendorShippingRow,
  fulfillmentType: ProductFulfillmentTypeCode,
): Prisma.Decimal {
  if (fulfillmentType === "FORSEIZ_STOCK") return new Prisma.Decimal("5.00");
  if (fulfillmentType === "ON_ORDER") return new Prisma.Decimal("20.00");
  return new Prisma.Decimal("15.00");
}
