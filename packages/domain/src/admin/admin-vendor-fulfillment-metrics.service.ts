import { prisma } from "@mlm/db";
import { getFulfillmentSlaConfig, hoursSince, isFulfillmentGroupStuck } from "../orders/fulfillment-sla";

export type VendorFulfillmentMetricsDto = {
  vendorId: string;
  storeName: string;
  ownerEmail: string;
  contactPhone: string | null;
  groupsShipped: number;
  avgShipHours: number | null;
  stuckNow: number;
  latePct: number | null;
  warnings30d: number;
  escalations30d: number;
};

function sinceDays(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function getVendorFulfillmentMetrics(vendorId: string): Promise<VendorFulfillmentMetricsDto | null> {
  const batch = await batchGetVendorFulfillmentMetrics([vendorId]);
  return batch.get(vendorId) ?? null;
}

export async function batchGetVendorFulfillmentMetrics(
  vendorIds: string[],
): Promise<Map<string, VendorFulfillmentMetricsDto>> {
  const result = new Map<string, VendorFulfillmentMetricsDto>();
  if (vendorIds.length === 0) return result;

  const since30 = sinceDays(30);
  const config = getFulfillmentSlaConfig();

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      storeName: true,
      contactPhone: true,
      owner: { select: { email: true } },
    },
  });

  const [shippedGroups, openGroups, escalations] = await Promise.all([
    prisma.orderVendorShipping.findMany({
      where: {
        vendorId: { in: vendorIds },
        fulfillmentStatus: "SHIPPED",
        fulfillmentUpdatedAt: { gte: since30 },
      },
      select: {
        vendorId: true,
        fulfillmentUpdatedAt: true,
        order: { select: { createdAt: true } },
      },
    }),
    prisma.orderVendorShipping.findMany({
      where: {
        vendorId: { in: vendorIds },
        fulfillmentStatus: { in: ["NEW", "PROCESSING"] },
        order: { status: { in: ["NEW", "PROCESSING", "SHIPPED"] } },
      },
      select: {
        vendorId: true,
        fulfillmentStatus: true,
        fulfillmentUpdatedAt: true,
      },
    }),
    prisma.orderFulfillmentEscalation.groupBy({
      by: ["vendorId", "level"],
      where: {
        vendorId: { in: vendorIds },
        createdAt: { gte: since30 },
      },
      _count: { _all: true },
    }),
  ]);

  const shippedByVendor = new Map<string, typeof shippedGroups>();
  for (const row of shippedGroups) {
    const list = shippedByVendor.get(row.vendorId) ?? [];
    list.push(row);
    shippedByVendor.set(row.vendorId, list);
  }

  const openByVendor = new Map<string, typeof openGroups>();
  for (const row of openGroups) {
    const list = openByVendor.get(row.vendorId) ?? [];
    list.push(row);
    openByVendor.set(row.vendorId, list);
  }

  const escByVendor = new Map<string, { warning: number; escalation: number }>();
  for (const row of escalations) {
    const current = escByVendor.get(row.vendorId) ?? { warning: 0, escalation: 0 };
    if (row.level === "WARNING") current.warning = row._count._all;
    if (row.level === "ESCALATION") current.escalation = row._count._all;
    escByVendor.set(row.vendorId, current);
  }

  for (const vendor of vendors) {
    const vendorShipped = shippedByVendor.get(vendor.id) ?? [];
    const vendorOpen = openByVendor.get(vendor.id) ?? [];
    const esc = escByVendor.get(vendor.id) ?? { warning: 0, escalation: 0 };

    const shipHours = vendorShipped.map((g) => hoursSince(g.order.createdAt));
    const avgShipHours =
      shipHours.length > 0
        ? Math.round((shipHours.reduce((a, b) => a + b, 0) / shipHours.length) * 10) / 10
        : null;

    const stuckNow = vendorOpen.filter((g) =>
      isFulfillmentGroupStuck(g.fulfillmentStatus, g.fulfillmentUpdatedAt, config),
    ).length;

    const lateCount = vendorShipped.filter((g) => {
      const shipH = hoursSince(g.order.createdAt);
      return shipH > config.processingMaxHours;
    }).length;

    const latePct =
      vendorShipped.length > 0 ? Math.round((lateCount / vendorShipped.length) * 1000) / 10 : null;

    result.set(vendor.id, {
      vendorId: vendor.id,
      storeName: vendor.storeName,
      ownerEmail: vendor.owner.email,
      contactPhone: vendor.contactPhone,
      groupsShipped: vendorShipped.length,
      avgShipHours,
      stuckNow,
      latePct,
      warnings30d: esc.warning,
      escalations30d: esc.escalation,
    });
  }

  return result;
}

export async function listVendorFulfillmentMetrics(params: {
  page: number;
  pageSize: number;
}): Promise<{
  items: VendorFulfillmentMetricsDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [vendors, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      skip,
      take: pageSize,
      orderBy: { storeName: "asc" },
      select: { id: true },
    }),
    prisma.vendor.count(),
  ]);

  const metrics = await batchGetVendorFulfillmentMetrics(vendors.map((v) => v.id));
  const items = vendors
    .map((v) => metrics.get(v.id))
    .filter((m): m is VendorFulfillmentMetricsDto => m != null);
  items.sort((a, b) => b.stuckNow - a.stuckNow || (b.latePct ?? 0) - (a.latePct ?? 0));

  return { items, total, page, pageSize, hasMore: skip + vendors.length < total };
}
