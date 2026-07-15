import type { OrderStatus, ProductFulfillmentType } from "@mlm/db";
import { Prisma, prisma } from "@mlm/db";
import type { ProductFulfillmentTypeCode } from "@mlm/shared";
import { adminMayUpdateFulfillmentType, vendorMayUpdateFulfillmentType } from "@mlm/shared";
import {
  getFulfillmentSlaConfig,
  hoursSince,
  isFulfillmentGroupStuck,
  slaThresholdHoursForStatus,
} from "./fulfillment-sla";

export type BlockingFulfillmentGroupDto = {
  vendorId: string;
  vendorName: string;
  ownerName: string;
  ownerEmail: string;
  contactPhone: string | null;
  fulfillmentType: ProductFulfillmentTypeCode;
  fulfillmentStatus: OrderStatus;
  fulfillmentUpdatedAt: string;
  hoursWaiting: number;
  isStuck: boolean;
  slaThresholdHours: number | null;
  canVendorUpdate: boolean;
  canAdminUpdate: boolean;
};

export type StuckOrderListItemDto = {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  createdAt: string;
  buyerName: string;
  buyerEmail: string;
  totalAmount: string;
  stuckGroupCount: number;
  worstHoursWaiting: number;
  primaryBlocker: {
    vendorName: string;
    fulfillmentType: ProductFulfillmentTypeCode;
    fulfillmentStatus: OrderStatus;
    hoursWaiting: number;
  } | null;
};

type StuckOrderSqlRow = {
  order_id: string;
  order_no: string;
  order_status: OrderStatus;
  created_at: Date;
  total_amount: Prisma.Decimal;
  buyer_name: string;
  buyer_email: string;
  stuck_group_count: bigint | number;
  worst_hours_waiting: number;
  vendor_name_snapshot: string | null;
  fulfillment_type: ProductFulfillmentType | null;
  fulfillment_status: OrderStatus | null;
  primary_hours_waiting: number | null;
};

async function loadVendorContacts(vendorIds: string[]) {
  if (vendorIds.length === 0) return new Map<string, { ownerName: string; ownerEmail: string; contactPhone: string | null }>();
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: {
      id: true,
      contactPhone: true,
      owner: { select: { name: true, email: true } },
    },
  });
  return new Map(
    vendors.map((v) => [
      v.id,
      { ownerName: v.owner.name, ownerEmail: v.owner.email, contactPhone: v.contactPhone },
    ]),
  );
}

export async function listBlockingFulfillmentGroups(orderId: string): Promise<BlockingFulfillmentGroupDto[]> {
  const config = getFulfillmentSlaConfig();
  const groups = await prisma.orderVendorShipping.findMany({
    where: {
      orderId,
      fulfillmentStatus: { in: ["NEW", "PROCESSING"] },
    },
    orderBy: [{ fulfillmentUpdatedAt: "asc" }],
  });
  const contacts = await loadVendorContacts([...new Set(groups.map((g) => g.vendorId))]);

  return groups.map((g) => {
    const contact = contacts.get(g.vendorId);
    const type = g.fulfillmentType as ProductFulfillmentTypeCode;
    const waiting = hoursSince(g.fulfillmentUpdatedAt);
    return {
      vendorId: g.vendorId,
      vendorName: g.vendorNameSnapshot,
      ownerName: contact?.ownerName ?? "",
      ownerEmail: contact?.ownerEmail ?? "",
      contactPhone: contact?.contactPhone ?? null,
      fulfillmentType: type,
      fulfillmentStatus: g.fulfillmentStatus,
      fulfillmentUpdatedAt: g.fulfillmentUpdatedAt.toISOString(),
      hoursWaiting: Math.round(waiting * 10) / 10,
      isStuck: isFulfillmentGroupStuck(g.fulfillmentStatus, g.fulfillmentUpdatedAt, config),
      slaThresholdHours: slaThresholdHoursForStatus(g.fulfillmentStatus, config),
      canVendorUpdate: vendorMayUpdateFulfillmentType(type),
      canAdminUpdate: adminMayUpdateFulfillmentType(type),
    };
  });
}

function stuckGroupSqlPredicate(config: ReturnType<typeof getFulfillmentSlaConfig>): Prisma.Sql {
  if (config.demoStuck) {
    return Prisma.sql`ovs.fulfillment_status IN ('NEW', 'PROCESSING')`;
  }
  return Prisma.sql`(
    (ovs.fulfillment_status = 'NEW' AND ovs.fulfillment_updated_at <= NOW() - (${config.newMaxHours}::text || ' hours')::interval)
    OR
    (ovs.fulfillment_status = 'PROCESSING' AND ovs.fulfillment_updated_at <= NOW() - (${config.processingMaxHours}::text || ' hours')::interval)
  )`;
}

async function queryStuckOrdersPage(params: {
  marketId: string;
  skip: number;
  take: number;
  config: ReturnType<typeof getFulfillmentSlaConfig>;
}): Promise<{ rows: StuckOrderSqlRow[]; total: number }> {
  const stuckPredicate = stuckGroupSqlPredicate(params.config);

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT o.id)::bigint AS total
    FROM orders o
    INNER JOIN order_vendor_shipping ovs ON ovs.order_id = o.id
    WHERE o.market_id = ${params.marketId}
      AND o.status IN ('NEW', 'PROCESSING', 'SHIPPED')
      AND ovs.fulfillment_status IN ('NEW', 'PROCESSING')
      AND ${stuckPredicate}
  `);

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { rows: [], total: 0 };
  }

  const rows = await prisma.$queryRaw<StuckOrderSqlRow[]>(Prisma.sql`
    WITH stuck_groups AS (
      SELECT
        o.id AS order_id,
        o.order_no,
        o.status AS order_status,
        o.created_at,
        o.total_amount,
        u.name AS buyer_name,
        u.email AS buyer_email,
        ovs.vendor_name_snapshot,
        ovs.fulfillment_type,
        ovs.fulfillment_status,
        EXTRACT(EPOCH FROM (NOW() - ovs.fulfillment_updated_at)) / 3600.0 AS hours_waiting
      FROM orders o
      INNER JOIN users u ON u.id = o.buyer_user_id
      INNER JOIN order_vendor_shipping ovs ON ovs.order_id = o.id
      WHERE o.market_id = ${params.marketId}
        AND o.status IN ('NEW', 'PROCESSING', 'SHIPPED')
        AND ovs.fulfillment_status IN ('NEW', 'PROCESSING')
        AND ${stuckPredicate}
    ),
    order_agg AS (
      SELECT
        order_id,
        order_no,
        order_status,
        created_at,
        total_amount,
        buyer_name,
        buyer_email,
        COUNT(*)::int AS stuck_group_count,
        MAX(hours_waiting) AS worst_hours_waiting
      FROM stuck_groups
      GROUP BY order_id, order_no, order_status, created_at, total_amount, buyer_name, buyer_email
    ),
    primary_blocker AS (
      SELECT DISTINCT ON (sg.order_id)
        sg.order_id,
        sg.vendor_name_snapshot,
        sg.fulfillment_type,
        sg.fulfillment_status,
        sg.hours_waiting AS primary_hours_waiting
      FROM stuck_groups sg
      INNER JOIN order_agg oa ON oa.order_id = sg.order_id
      ORDER BY sg.order_id, sg.hours_waiting DESC
    )
    SELECT
      oa.order_id,
      oa.order_no,
      oa.order_status,
      oa.created_at,
      oa.total_amount,
      oa.buyer_name,
      oa.buyer_email,
      oa.stuck_group_count,
      oa.worst_hours_waiting,
      pb.vendor_name_snapshot,
      pb.fulfillment_type,
      pb.fulfillment_status,
      pb.primary_hours_waiting
    FROM order_agg oa
    LEFT JOIN primary_blocker pb ON pb.order_id = oa.order_id
    ORDER BY oa.worst_hours_waiting DESC, oa.created_at DESC
    OFFSET ${params.skip}
    LIMIT ${params.take}
  `);

  return { rows, total };
}

export async function listStuckOrders(params: {
  page: number;
  pageSize: number;
  marketId: string;
}): Promise<{
  items: StuckOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  slaConfig: ReturnType<typeof getFulfillmentSlaConfig>;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const config = getFulfillmentSlaConfig();

  if (config.bypass) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      hasMore: false,
      slaConfig: config,
    };
  }

  const { rows, total } = await queryStuckOrdersPage({
    marketId: params.marketId,
    skip,
    take: pageSize,
    config,
  });

  const items: StuckOrderListItemDto[] = rows.map((row) => ({
    orderId: row.order_id,
    orderNo: row.order_no,
    orderStatus: row.order_status,
    createdAt: row.created_at.toISOString(),
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    totalAmount: row.total_amount.toString(),
    stuckGroupCount: Number(row.stuck_group_count),
    worstHoursWaiting: Math.round(Number(row.worst_hours_waiting) * 10) / 10,
    primaryBlocker:
      row.vendor_name_snapshot && row.fulfillment_type && row.fulfillment_status
        ? {
            vendorName: row.vendor_name_snapshot,
            fulfillmentType: row.fulfillment_type as ProductFulfillmentTypeCode,
            fulfillmentStatus: row.fulfillment_status,
            hoursWaiting: Math.round(Number(row.primary_hours_waiting ?? 0) * 10) / 10,
          }
        : null,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + items.length < total,
    slaConfig: config,
  };
}

export async function countStuckFulfillmentGroups(marketId?: string): Promise<number> {
  const config = getFulfillmentSlaConfig();
  if (config.bypass) return 0;

  const stuckPredicate = stuckGroupSqlPredicate(config);
  const marketFilter = marketId
    ? Prisma.sql`AND o.market_id = ${marketId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM order_vendor_shipping ovs
    INNER JOIN orders o ON o.id = ovs.order_id
    WHERE o.status IN ('NEW', 'PROCESSING', 'SHIPPED')
      AND ovs.fulfillment_status IN ('NEW', 'PROCESSING')
      ${marketFilter}
      AND ${stuckPredicate}
  `);

  return Number(rows[0]?.total ?? 0);
}
