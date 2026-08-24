import { Prisma, prisma } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";
import type { ShippingPackageTypeCode, VendorIndirectFulfillmentCode } from "@mlm/shared";

export function shippingRateCode(
  packageType: ShippingPackageTypeCode,
  fourcesMode?: VendorIndirectFulfillmentCode | null,
): string {
  if (packageType === "MERCHANT_DOMESTIC") return "MERCHANT_DOMESTIC";
  if (packageType === "MERCHANT_INTERNATIONAL") return "MERCHANT_INTERNATIONAL";
  const mode = fourcesMode === "ON_ORDER" ? "ON_ORDER" : "STOCK";
  if (packageType === "FOURCES_DOMESTIC") {
    return mode === "ON_ORDER" ? "FOURCES_DOMESTIC_ON_ORDER" : "FOURCES_DOMESTIC_STOCK";
  }
  return mode === "ON_ORDER" ? "FOURCES_INTERNATIONAL_ON_ORDER" : "FOURCES_INTERNATIONAL_STOCK";
}

/** Fallback amounts if a rate row is missing (should be seeded). */
const FALLBACK_AMOUNTS: Record<string, string> = {
  MERCHANT_DOMESTIC: "15.00",
  MERCHANT_INTERNATIONAL: "25.00",
  FOURCES_DOMESTIC_STOCK: "5.00",
  FOURCES_DOMESTIC_ON_ORDER: "20.00",
  FOURCES_INTERNATIONAL_STOCK: "15.00",
  FOURCES_INTERNATIONAL_ON_ORDER: "30.00",
};

export type ShippingRateDto = {
  id: string;
  marketId: string;
  code: string;
  packageType: ShippingPackageTypeCode;
  fourcesMode: VendorIndirectFulfillmentCode | null;
  amount: string;
  currency: string;
  perUnit: boolean;
  isActive: boolean;
};

function mapRow(row: {
  id: string;
  marketId: string;
  code: string;
  packageType: string;
  fourcesMode: string | null;
  amount: Prisma.Decimal;
  currency: string;
  perUnit: boolean;
  isActive: boolean;
}): ShippingRateDto {
  return {
    id: row.id,
    marketId: row.marketId,
    code: row.code,
    packageType: row.packageType as ShippingPackageTypeCode,
    fourcesMode: (row.fourcesMode as VendorIndirectFulfillmentCode | null) ?? null,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    perUnit: row.perUnit,
    isActive: row.isActive,
  };
}

export async function listShippingRates(params?: {
  marketId?: string;
  db?: Prisma.TransactionClient | typeof prisma;
}): Promise<ShippingRateDto[]> {
  const db = params?.db ?? prisma;
  const rows = await db.shippingRate.findMany({
    where: params?.marketId ? { marketId: params.marketId } : undefined,
    orderBy: [{ marketId: "asc" }, { code: "asc" }],
  });
  return rows.map(mapRow);
}

export async function resolveShippingRateAmount(params: {
  marketId?: string;
  packageType: ShippingPackageTypeCode;
  fourcesMode?: VendorIndirectFulfillmentCode | null;
  quantity?: number;
  db?: Prisma.TransactionClient | typeof prisma;
}): Promise<Prisma.Decimal> {
  const db = params.db ?? prisma;
  const marketId = params.marketId ?? DEFAULT_MARKET_ID;
  const code = shippingRateCode(params.packageType, params.fourcesMode);
  const row = await db.shippingRate.findFirst({
    where: { marketId, code, isActive: true },
    select: { amount: true, perUnit: true },
  });

  const unitAmount = row
    ? new Prisma.Decimal(row.amount.toString())
    : new Prisma.Decimal(FALLBACK_AMOUNTS[code] ?? "15.00");
  const perUnit = row?.perUnit ?? true;
  const qty = Math.max(1, params.quantity ?? 1);
  return perUnit ? unitAmount.mul(qty) : unitAmount;
}

export async function updateShippingRateAmount(params: {
  marketId: string;
  code: string;
  amount: number;
  perUnit?: boolean;
  isActive?: boolean;
}): Promise<ShippingRateDto> {
  const row = await prisma.shippingRate.update({
    where: { marketId_code: { marketId: params.marketId, code: params.code } },
    data: {
      amount: params.amount,
      ...(params.perUnit !== undefined ? { perUnit: params.perUnit } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
    },
  });
  return mapRow(row);
}
