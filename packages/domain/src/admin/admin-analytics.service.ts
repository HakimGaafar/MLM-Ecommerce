import { OrderStatus, Prisma, prisma } from "@mlm/db";
import { week1BusinessRules } from "../business-rules";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function moneyStr(n: number): string {
  return roundMoney(n).toFixed(2);
}

const EXCLUDED: OrderStatus = "CANCELLED";

export type AdminAnalyticsDto = {
  generatedAt: string;
  currency: string;
  summary: {
    totalOrders: number;
    totalGmv: string;
    averageOrderValue: string;
  };
  ordersByStatus: { status: OrderStatus; count: number }[];
  ordersOverTime: { date: string; orderCount: number; gmv: string }[];
  vendorsByGmv: { vendorId: string; storeName: string; orderCount: number; gmv: string }[];
  regions: { countryCode: string; orderCount: number; gmv: string }[];
  topProducts: { productId: string | null; name: string; unitsSold: number; gmv: string }[];
};

export async function getAdminAnalytics(marketId: string): Promise<AdminAnalyticsDto> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { defaultCurrency: true },
  });
  const currency = market?.defaultCurrency ?? week1BusinessRules.currency;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  since.setUTCHours(0, 0, 0, 0);

  const orderMarketWhere = { marketId, status: { not: EXCLUDED } } as const;

  const [statusGroups, orderAgg, dailyRows, vendorRows, regionRows, productRows] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { marketId },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: orderMarketWhere,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.$queryRaw<{ day: Date; order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') AS day,
             COUNT(*)::bigint AS order_count,
             COALESCE(SUM(total_amount), 0) AS gmv
      FROM orders
      WHERE status::text != ${EXCLUDED}
        AND market_id = ${marketId}
        AND created_at >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.$queryRaw<{ vendor_id: string; store_name: string; order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT oi.vendor_id,
             v.store_name,
             COUNT(DISTINCT o.id)::bigint AS order_count,
             COALESCE(SUM(oi.line_total), 0) AS gmv
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN vendors v ON v.id = oi.vendor_id
      WHERE o.status::text != ${EXCLUDED}
        AND o.market_id = ${marketId}
      GROUP BY oi.vendor_id, v.store_name
      ORDER BY gmv DESC
      LIMIT 10
    `,
    prisma.$queryRaw<{ country_code: string; order_count: bigint; gmv: Prisma.Decimal }[]>`
      SELECT COALESCE(shipping_country_code, 'UNKNOWN') AS country_code,
             COUNT(*)::bigint AS order_count,
             COALESCE(SUM(total_amount), 0) AS gmv
      FROM orders
      WHERE status::text != ${EXCLUDED}
        AND market_id = ${marketId}
      GROUP BY 1
      ORDER BY gmv DESC
      LIMIT 15
    `,
    prisma.$queryRaw<{ product_id: string | null; name: string; units_sold: bigint; gmv: Prisma.Decimal }[]>`
      SELECT oi.product_id,
             MAX(oi.product_name_snapshot) AS name,
             COALESCE(SUM(oi.quantity), 0)::bigint AS units_sold,
             COALESCE(SUM(oi.line_total), 0) AS gmv
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.status::text != ${EXCLUDED}
        AND o.market_id = ${marketId}
      GROUP BY oi.product_id
      ORDER BY gmv DESC
      LIMIT 10
    `,
  ]);

  const totalOrders = orderAgg._count._all ?? 0;
  const totalGmv = Number(orderAgg._sum.totalAmount ?? 0);
  const aov = totalOrders > 0 ? totalGmv / totalOrders : 0;

  return {
    generatedAt: new Date().toISOString(),
    currency,
    summary: {
      totalOrders,
      totalGmv: moneyStr(totalGmv),
      averageOrderValue: moneyStr(aov),
    },
    ordersByStatus: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    ordersOverTime: dailyRows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      orderCount: Number(r.order_count),
      gmv: moneyStr(Number(r.gmv)),
    })),
    vendorsByGmv: vendorRows.map((r) => ({
      vendorId: r.vendor_id,
      storeName: r.store_name,
      orderCount: Number(r.order_count),
      gmv: moneyStr(Number(r.gmv)),
    })),
    regions: regionRows.map((r) => ({
      countryCode: r.country_code,
      orderCount: Number(r.order_count),
      gmv: moneyStr(Number(r.gmv)),
    })),
    topProducts: productRows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      unitsSold: Number(r.units_sold),
      gmv: moneyStr(Number(r.gmv)),
    })),
  };
}
