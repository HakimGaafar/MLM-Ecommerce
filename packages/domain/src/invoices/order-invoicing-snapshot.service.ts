import { Prisma, prisma, type Prisma as PrismaNs } from "@mlm/db";
import { resolveInvoicingParty } from "../admin/admin-legal-foundations.service";
import { getPlatformConfig } from "../platform-config/platform-config.service";
import { resolveCommissionSplit } from "../commission/commission-rate.service";

export type OrderVendorInvoicingSnapshot = {
  vendorId: string;
  sellerMarketId: string;
  buyerMarketId: string;
  invoicingParty: "MERCHANT" | "PLATFORM";
  commissionRate: number;
};

/** Resolve and persist invoicing party + commission rate per vendor at order create. */
export async function snapshotOrderVendorInvoicing(params: {
  orderId: string;
  buyerMarketId: string;
  buyerMarketCode: string | null;
  vendorIds: string[];
  tx?: PrismaNs.TransactionClient;
}): Promise<OrderVendorInvoicingSnapshot[]> {
  const db = params.tx ?? prisma;
  if (params.vendorIds.length === 0) return [];

  const vendors = await db.vendor.findMany({
    where: { id: { in: params.vendorIds } },
    select: { id: true, primaryMarketId: true },
  });
  const config = await getPlatformConfig(params.buyerMarketId);
  const snapshots: OrderVendorInvoicingSnapshot[] = [];

  for (const vendor of vendors) {
    const resolved = await resolveInvoicingParty({
      sellerMarketId: vendor.primaryMarketId,
      buyerMarketId: params.buyerMarketId,
    });
    let commissionRate = resolved.commissionRate;
    if (commissionRate == null) {
      const split = resolveCommissionSplit({
        vendorPrimaryMarketId: vendor.primaryMarketId,
        orderMarketId: params.buyerMarketId,
        orderMarketCode: params.buyerMarketCode,
        config,
      });
      commissionRate = split.platformRate;
    }
    snapshots.push({
      vendorId: vendor.id,
      sellerMarketId: vendor.primaryMarketId,
      buyerMarketId: params.buyerMarketId,
      invoicingParty: resolved.invoicingParty,
      commissionRate,
    });
  }

  if (snapshots.length > 0) {
    await db.orderVendorInvoicing.createMany({
      data: snapshots.map((row) => ({
        orderId: params.orderId,
        vendorId: row.vendorId,
        sellerMarketId: row.sellerMarketId,
        buyerMarketId: row.buyerMarketId,
        invoicingParty: row.invoicingParty,
        commissionRate: new Prisma.Decimal(row.commissionRate.toFixed(6)),
      })),
    });
  }

  return snapshots;
}

export async function getOrderVendorInvoicingSnapshots(orderId: string) {
  return prisma.orderVendorInvoicing.findMany({
    where: { orderId },
    select: {
      vendorId: true,
      sellerMarketId: true,
      buyerMarketId: true,
      invoicingParty: true,
      commissionRate: true,
    },
  });
}
