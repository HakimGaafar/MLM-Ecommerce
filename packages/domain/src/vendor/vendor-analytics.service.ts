import { OrderStatus, Prisma, prisma } from "@mlm/db";
import type { ProductStatus } from "@mlm/shared";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function moneyStr(n: number): string {
  return roundMoney(n).toFixed(2);
}

const EXCLUDED: OrderStatus = "CANCELLED";

export type VendorAnalyticsDto = {
  generatedAt: string;
  currency: string;
  today: {
    orderCount: number;
    gmv: string;
    itemsSold: number;
  };
  monthCompare: {
    thisMonth: { orderCount: number; gmv: string };
    lastMonth: { orderCount: number; gmv: string };
  };
  ordersByStatus: { status: OrderStatus; count: number }[];
  ordersOverTime: { date: string; orderCount: number; gmv: string }[];
};

export type VendorDashboardSnapshotDto = {
  productsTotal: number;
  productsByStatus: { status: ProductStatus; count: number }[];
  activeCoupons: number;
};

export async function getVendorDashboardSnapshot(vendorId: string): Promise<VendorDashboardSnapshotDto> {
  const [groups, activeCoupons] = await Promise.all([
    prisma.product.groupBy({
      by: ["status"],
      where: { vendorId },
      _count: { _all: true },
    }),
    prisma.coupon.count({
      where: { vendorId, status: "ACTIVE" },
    }),
  ]);

  const productsByStatus = groups.map((g) => ({
    status: g.status as ProductStatus,
    count: g._count._all,
  }));

  const productsTotal = productsByStatus.reduce((s, row) => s + row.count, 0);

  return {
    productsTotal,
    productsByStatus,
    activeCoupons,
  };
}

export async function getVendorAnalytics(vendorId: string): Promise<VendorAnalyticsDto> {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const startOfTrend = new Date(startOfToday);
  startOfTrend.setUTCDate(startOfTrend.getUTCDate() - 30);

  const vendorFilter = Prisma.sql`oi.vendor_id = ${vendorId}`;
  const notCancelled = Prisma.sql`o.status::text != ${EXCLUDED}`;
  const realizedRevenue = Prisma.sql`${notCancelled} AND o.payment_status::text = 'PAID'`;

  const [todayRow, monthRow, lastMonthRow, statusRows, dailyRows] = await Promise.all([
    prisma.$queryRaw<{ order_count: bigint; gmv: Prisma.Decimal; items_sold: bigint }[]>`
      SELECT COUNT(DISTINCT o.id)::bigint AS order_count,
             COALESCE(SUM(CASE WHEN ${realizedRevenue} THEN oi.line_total ELSE 0 END), 0) AS gmv,
             COALESCE(SUM(CASE WHEN ${realizedRevenue} THEN oi.quantity ELSE 0 END), 0)::bigint AS items_sold
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE ${vendorFilter} AND ${notCancelled}
        AND o.created_at >= ${startOfToday}
    `,
    prisma.$queryRaw<{ order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT COUNT(DISTINCT o.id)::bigint AS order_count,
             COALESCE(SUM(CASE WHEN ${realizedRevenue} THEN oi.line_total ELSE 0 END), 0) AS gmv
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE ${vendorFilter} AND ${notCancelled}
        AND o.created_at >= ${startOfMonth}
    `,
    prisma.$queryRaw<{ order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT COUNT(DISTINCT o.id)::bigint AS order_count,
             COALESCE(SUM(CASE WHEN ${realizedRevenue} THEN oi.line_total ELSE 0 END), 0) AS gmv
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE ${vendorFilter} AND ${notCancelled}
        AND o.created_at >= ${startOfLastMonth}
        AND o.created_at < ${startOfMonth}
    `,
    prisma.$queryRaw<{ status: OrderStatus; count: bigint }[]>`
      SELECT o.status::text AS status, COUNT(DISTINCT o.id)::bigint AS count
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE ${vendorFilter}
      GROUP BY o.status
    `,
    prisma.$queryRaw<{ day: Date; order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT DATE_TRUNC('day', o.created_at AT TIME ZONE 'UTC') AS day,
             COUNT(DISTINCT o.id)::bigint AS order_count,
             COALESCE(SUM(CASE WHEN ${realizedRevenue} THEN oi.line_total ELSE 0 END), 0) AS gmv
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE ${vendorFilter} AND ${notCancelled}
        AND o.created_at >= ${startOfTrend}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const today = todayRow[0];
  const month = monthRow[0];
  const lastMonth = lastMonthRow[0];

  return {
    generatedAt: now.toISOString(),
    currency: "SAR",
    today: {
      orderCount: Number(today?.order_count ?? 0),
      gmv: moneyStr(Number(today?.gmv ?? 0)),
      itemsSold: Number(today?.items_sold ?? 0),
    },
    monthCompare: {
      thisMonth: {
        orderCount: Number(month?.order_count ?? 0),
        gmv: moneyStr(Number(month?.gmv ?? 0)),
      },
      lastMonth: {
        orderCount: Number(lastMonth?.order_count ?? 0),
        gmv: moneyStr(Number(lastMonth?.gmv ?? 0)),
      },
    },
    ordersByStatus: statusRows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    })),
    ordersOverTime: dailyRows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      orderCount: Number(r.order_count),
      gmv: moneyStr(Number(r.gmv)),
    })),
  };
}
