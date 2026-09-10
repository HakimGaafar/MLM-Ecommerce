import { OrderReturnStatus, OrderStatus, prisma } from "@mlm/db";
import { week1BusinessRules } from "../business-rules";
import { countPendingKycDocuments } from "./admin-kyc.service";
import { countStuckFulfillmentGroups } from "../orders/order-stuck.service";

function moneyStr(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

const EXCLUDED: OrderStatus = "CANCELLED";

const TERMINAL_RETURN_STATUSES: OrderReturnStatus[] = [
  "REFUND_COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "PROCESSING_REJECTED",
];

const ACTIVE_CUSTOMER_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export type AdminDashboardOverviewDto = {
  generatedAt: string;
  currency: string;
  marketplace: {
    totalOrders: number;
    totalGmv: string;
    averageOrderValue: string;
  };
  ordersByStatus: { status: OrderStatus; count: number }[];
  counts: {
    users: number;
    vendors: number;
    vendorsPendingApproval: number;
    productsPendingApproval: number;
    ordersNew: number;
    customersTotal: number;
    customersActive3m: number;
    returnsInProgress: number;
    withdrawalsPending: number;
    pendingSettlements: number;
    affiliatesActive: number;
    stuckFulfillmentGroups: number;
    kycPendingReview: number;
    shippingApprovalsPending: number;
  };
};

/**
 * Lightweight aggregates for the admin home dashboard (avoids full analytics queries).
 */
export async function getAdminDashboardOverview(marketId: string): Promise<AdminDashboardOverviewDto> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { defaultCurrency: true },
  });
  const currency = market?.defaultCurrency ?? week1BusinessRules.currency;
  const generatedAt = new Date().toISOString();
  const activeSince = new Date(Date.now() - ACTIVE_CUSTOMER_WINDOW_MS);

  const [
    orderAgg,
    statusGroups,
    users,
    vendors,
    vendorsPendingApproval,
    pendingProducts,
    pendingProductEdits,
    ordersNew,
    customersTotal,
    customersActive3m,
    returnsInProgress,
    withdrawalsPending,
    pendingSettlements,
    affiliatesActive,
    stuckFulfillmentGroups,
    kycPendingReview,
    shippingApprovalsPending,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { marketId, status: { not: EXCLUDED } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { marketId },
      _count: { _all: true },
    }),
    prisma.user.count(),
    prisma.vendor.count({ where: { marketId } }),
    prisma.vendor.count({ where: { marketId, storeApprovalStatus: "PENDING" } }),
    prisma.product.count({ where: { status: "PENDING", marketId } }),
    prisma.productEditRequest.count({
      where: { status: "PENDING", product: { marketId } },
    }),
    prisma.order.count({ where: { marketId, status: "NEW" } }),
    prisma.userRole.count({ where: { role: { code: "CUSTOMER" } } }),
    prisma.user.count({
      where: {
        status: "ACTIVE",
        lastLoginAt: { gte: activeSince },
        userRoles: { some: { role: { code: "CUSTOMER" } } },
      },
    }),
    prisma.orderReturn.count({
      where: {
        status: { notIn: TERMINAL_RETURN_STATUSES },
        order: { marketId },
      },
    }),
    prisma.walletTransaction.count({
      where: {
        entryType: "WITHDRAWAL",
        status: "PENDING",
        wallet: { marketId },
      },
    }),
    prisma.walletTransaction.count({
      where: {
        status: "PENDING",
        direction: "CREDIT",
        entryType: { in: ["AFFILIATE_COMMISSION", "VENDOR_EARNING"] },
        wallet: { marketId },
      },
    }),
    prisma.affiliateProfile.count({ where: { isActive: true } }),
    countStuckFulfillmentGroups(marketId),
    countPendingKycDocuments(),
    prisma.vendorShippingChangeRequest.count({
      where: { status: "PENDING", vendor: { marketId } },
    }),
  ]);

  const totalOrders = orderAgg._count._all ?? 0;
  const totalGmv = Number(orderAgg._sum.totalAmount ?? 0);
  const aov = totalOrders > 0 ? totalGmv / totalOrders : 0;

  return {
    generatedAt,
    currency,
    marketplace: {
      totalOrders,
      totalGmv: moneyStr(totalGmv),
      averageOrderValue: moneyStr(aov),
    },
    ordersByStatus: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    counts: {
      users,
      vendors,
      vendorsPendingApproval,
      productsPendingApproval: pendingProducts + pendingProductEdits,
      ordersNew,
      customersTotal,
      customersActive3m,
      returnsInProgress,
      withdrawalsPending,
      pendingSettlements,
      affiliatesActive,
      stuckFulfillmentGroups,
      kycPendingReview,
      shippingApprovalsPending,
    },
  };
}
