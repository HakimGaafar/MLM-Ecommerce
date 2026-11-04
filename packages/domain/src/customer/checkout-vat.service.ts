import { prisma } from "@mlm/db";
import { getMarketInvoiceIssuer } from "../invoices/market-invoice-issuer.service";

export type CheckoutVatLineDto = {
  kind: "VENDOR_GOODS" | "WAREHOUSE_SHIPPING";
  vendorId: string | null;
  label: string;
  taxableBase: string;
  vatRatePercent: number;
  vatAmount: string;
};

export type CheckoutVatResult = {
  vatTotal: string;
  vatBreakdown: CheckoutVatLineDto[];
  /** Display hint: primary rate used when all lines share one rate; else null. */
  displayVatPercent: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function vendorVatRateFraction(params: {
  invoiceVatTrn: string | null;
  invoiceVatPercent: { toString(): string } | null;
}): number {
  const trn = params.invoiceVatTrn?.trim();
  const pct = params.invoiceVatPercent != null ? Number(params.invoiceVatPercent) : 0;
  if (trn && Number.isFinite(pct) && pct > 0) return pct / 100;
  return 0;
}

/**
 * Phase 0 §4 / Phase 6: VAT per vendor (registration) on goods + direct shipping;
 * warehouse shipping VAT follows market issuer. Summed for order.vatTotal.
 */
export async function computeCheckoutVat(params: {
  marketId: string;
  lines: {
    vendorId: string;
    vendorName: string;
    lineTotal: { toString(): string } | number;
  }[];
  shippingLines: {
    vendorId: string;
    vendorName: string;
    fulfillmentType: string;
    fee: { toString(): string } | number;
  }[];
  discountTotal: number;
}): Promise<CheckoutVatResult> {
  const merchandiseByVendor = new Map<string, { name: string; subtotal: number }>();
  let orderMerchandise = 0;
  for (const line of params.lines) {
    const amount = Number(line.lineTotal);
    orderMerchandise += amount;
    const existing = merchandiseByVendor.get(line.vendorId);
    if (existing) existing.subtotal += amount;
    else merchandiseByVendor.set(line.vendorId, { name: line.vendorName, subtotal: amount });
  }

  const vendorIds = [...merchandiseByVendor.keys()];
  const vendors =
    vendorIds.length === 0
      ? []
      : await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: {
            id: true,
            storeName: true,
            invoiceVatTrn: true,
            invoiceVatPercent: true,
          },
        });
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  const directShipByVendor = new Map<string, number>();
  let warehouseShipTotal = 0;
  let warehouseShipLabel = "Warehouse shipping";
  for (const ship of params.shippingLines) {
    const fee = Number(ship.fee);
    if (ship.fulfillmentType === "DIRECT") {
      directShipByVendor.set(
        ship.vendorId,
        (directShipByVendor.get(ship.vendorId) ?? 0) + fee,
      );
    } else {
      warehouseShipTotal += fee;
      warehouseShipLabel = `${ship.vendorName} warehouse shipping`;
    }
  }

  const breakdown: CheckoutVatLineDto[] = [];
  let vatSum = 0;
  const ratesUsed = new Set<number>();

  for (const [vendorId, merch] of merchandiseByVendor) {
    const vendor = vendorMap.get(vendorId);
    const rate = vendor
      ? vendorVatRateFraction(vendor)
      : 0;
    const ratio =
      orderMerchandise > 0 ? Math.min(1, merch.subtotal / orderMerchandise) : 0;
    const discountShare = round2(params.discountTotal * ratio);
    const shippingShare = round2(directShipByVendor.get(vendorId) ?? 0);
    const taxable = round2(Math.max(0, merch.subtotal + shippingShare - discountShare));
    const vatAmount = round2(taxable * rate);
    vatSum += vatAmount;
    const pct = round2(rate * 100);
    ratesUsed.add(pct);
    breakdown.push({
      kind: "VENDOR_GOODS",
      vendorId,
      label: vendor?.storeName ?? merch.name,
      taxableBase: taxable.toFixed(2),
      vatRatePercent: pct,
      vatAmount: vatAmount.toFixed(2),
    });
  }

  if (warehouseShipTotal > 0) {
    const issuer = await getMarketInvoiceIssuer(params.marketId);
    const rate =
      issuer.vatRegistered && issuer.vatPercent > 0 ? issuer.vatPercent / 100 : 0;
    const taxable = round2(warehouseShipTotal);
    const vatAmount = round2(taxable * rate);
    vatSum += vatAmount;
    const pct = round2(rate * 100);
    ratesUsed.add(pct);
    breakdown.push({
      kind: "WAREHOUSE_SHIPPING",
      vendorId: null,
      label: warehouseShipLabel,
      taxableBase: taxable.toFixed(2),
      vatRatePercent: pct,
      vatAmount: vatAmount.toFixed(2),
    });
  }

  const displayVatPercent =
    ratesUsed.size === 1 ? ([...ratesUsed][0] ?? null) : null;

  return {
    vatTotal: round2(vatSum).toFixed(2),
    vatBreakdown: breakdown,
    displayVatPercent,
  };
}
