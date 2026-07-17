import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import type { OrderUnitStatus } from "@mlm/db";
import { RETURN_STATUSES_BLOCKING_NEW } from "../customer/orders.service";
import { rollupOrderStatus } from "./order-fulfillment-groups.service";
import { getPaymentGateway } from "../payments/payment-gateway";
import { StripeRefundError } from "../payments/stripe-refund.service";
import { ensureWalletInTx } from "../wallet/wallet.service";

export class OrderVendorCancelError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "NOT_MULTI_VENDOR"
      | "ORDER_FINALIZED"
      | "ALREADY_CANCELLED"
      | "NO_ACTIVE_ITEMS"
      | "ACTIVE_RETURN"
      | "STRIPE_REFUND_FAILED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderVendorCancelError";
  }
}

export type OrderVendorCancellationDto = {
  id: string;
  vendorId: string;
  vendorName: string;
  reason: string;
  refundAmount: string;
  status: string;
  createdAt: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function activeVendorIdsFromItems(
  items: Array<{ vendorId: string; unitStatus: OrderUnitStatus }>,
): Set<string> {
  const active = items.filter((item) => item.unitStatus !== "CANCELLED").map((item) => item.vendorId);
  if (active.length > 0) {
    return new Set(active);
  }
  return new Set(items.map((item) => item.vendorId));
}

export async function listOrderVendorCancellations(orderId: string): Promise<OrderVendorCancellationDto[]> {
  const rows = await prisma.orderVendorCancellation.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { storeName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    vendorId: r.vendorId,
    vendorName: r.vendor.storeName,
    reason: r.reason,
    refundAmount: r.refundAmount.toString(),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function cancelVendorFromOrder(input: {
  orderId: string;
  vendorId: string;
  reason: string;
  createdByUserId: string;
}): Promise<OrderVendorCancellationDto> {
  const reason = input.reason.trim();
  if (reason.length < 10) {
    throw new OrderVendorCancelError("NOT_FOUND", "A cancellation reason of at least 10 characters is required.");
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      items: { select: { id: true, vendorId: true, unitStatus: true, lineTotal: true } },
      vendorShippingLines: { select: { vendorId: true, fee: true } },
    },
  });
  if (!order) throw new OrderVendorCancelError("NOT_FOUND", "Order not found.");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new OrderVendorCancelError("ORDER_FINALIZED", "Cannot cancel a vendor after the order is finalized.");
  }

  const vendorIds = activeVendorIdsFromItems(
    order.items.map((item) => ({
      vendorId: item.vendorId,
      unitStatus: item.unitStatus,
    })),
  );
  if (vendorIds.size < 2) {
    throw new OrderVendorCancelError("NOT_MULTI_VENDOR", "Vendor cancellation is only for multi-vendor orders.");
  }
  if (!vendorIds.has(input.vendorId)) {
    throw new OrderVendorCancelError("NOT_FOUND", "Vendor is not part of this order.");
  }

  const existing = await prisma.orderVendorCancellation.findUnique({
    where: { orderId_vendorId: { orderId: input.orderId, vendorId: input.vendorId } },
  });
  if (existing?.status === "COMPLETED") {
    throw new OrderVendorCancelError("ALREADY_CANCELLED", "This vendor was already removed from the order.");
  }

  const activeItems = order.items.filter(
    (i) => i.vendorId === input.vendorId && i.unitStatus === "ACTIVE",
  );
  if (activeItems.length === 0) {
    throw new OrderVendorCancelError("NO_ACTIVE_ITEMS", "No active items remain for this vendor.");
  }

  const blockingReturn = await prisma.orderReturn.findFirst({
    where: { orderId: input.orderId, status: { in: RETURN_STATUSES_BLOCKING_NEW } },
    select: { id: true },
  });
  if (blockingReturn) {
    throw new OrderVendorCancelError("ACTIVE_RETURN", "An active return blocks vendor cancellation.");
  }

  const cancelledSubtotal = activeItems.reduce((s, i) => s + Number(i.lineTotal), 0);
  const cancelledShipping = order.vendorShippingLines
    .filter((l) => l.vendorId === input.vendorId)
    .reduce((s, l) => s + Number(l.fee), 0);

  const orderSubtotal = Number(order.subtotal);
  const ratio = orderSubtotal > 0 ? Math.min(1, cancelledSubtotal / orderSubtotal) : 0;
  const cancelledDiscount = roundMoney(Number(order.discountTotal) * ratio);
  const cancelledVat = roundMoney(Number(order.vatTotal) * ratio);
  const refundAmount = roundMoney(
    cancelledSubtotal + cancelledShipping - cancelledDiscount + cancelledVat,
  );

  const walletDebit = await prisma.walletTransaction.aggregate({
    where: {
      referenceType: "order",
      referenceId: order.id,
      entryType: "ORDER_PAYMENT",
      direction: "DEBIT",
      status: "APPROVED",
    },
    _sum: { amount: true },
  });
  const walletApplied = Number(walletDebit._sum.amount ?? 0);
  const totalBefore = Number(order.totalAmount);
  const stripePaid =
    order.paymentStatus === "PAID" && order.stripeCheckoutSessionId
      ? Math.max(0, roundMoney(totalBefore - walletApplied))
      : 0;

  const walletRefund = roundMoney(Math.min(refundAmount, walletApplied));
  const stripeRefund = roundMoney(Math.min(refundAmount - walletRefund, stripePaid));

  if (stripeRefund > 0 && order.stripeCheckoutSessionId) {
    try {
      await getPaymentGateway().refundOrderAmount(
        order.stripeCheckoutSessionId,
        stripeRefund.toFixed(2),
      );
    } catch (e) {
      const msg =
        e instanceof StripeRefundError ? e.message : "Stripe refund failed.";
      throw new OrderVendorCancelError("STRIPE_REFUND_FAILED", msg);
    }
  } else if (stripeRefund > 0 && !order.stripeCheckoutSessionId) {
    throw new OrderVendorCancelError(
      "STRIPE_REFUND_FAILED",
      "Card refund required but no Stripe session is linked to this order.",
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { storeName: true },
  });

  const row = await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.orderItem.updateMany({
      where: { orderId: input.orderId, vendorId: input.vendorId, unitStatus: "ACTIVE" },
      data: {
        unitStatus: "CANCELLED",
        vendorFulfillmentStatus: "CANCELLED",
        vendorFulfillmentUpdatedAt: now,
      },
    });
    await tx.orderVendorShipping.updateMany({
      where: { orderId: input.orderId, vendorId: input.vendorId },
      data: { fulfillmentStatus: "CANCELLED", fulfillmentUpdatedAt: now },
    });

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        subtotal: new Prisma.Decimal(roundMoney(orderSubtotal - cancelledSubtotal)),
        shippingFee: new Prisma.Decimal(
          roundMoney(Number(order.shippingFee) - cancelledShipping),
        ),
        discountTotal: new Prisma.Decimal(
          roundMoney(Number(order.discountTotal) - cancelledDiscount),
        ),
        vatTotal: new Prisma.Decimal(roundMoney(Number(order.vatTotal) - cancelledVat)),
        totalAmount: new Prisma.Decimal(roundMoney(totalBefore - refundAmount)),
      },
    });

    if (walletRefund > 0) {
      const wallet = await ensureWalletInTx(tx, order.buyerUserId, order.marketId);
      const key = `vendor-cancel:${input.orderId}:${input.vendorId}`;
      const existingTx = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: key },
      });
      if (!existingTx) {
        const amountDec = new Prisma.Decimal(walletRefund);
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: order.buyerUserId,
            entryType: "ADJUSTMENT",
            direction: "CREDIT",
            amount: amountDec,
            status: "APPROVED",
            referenceType: "order_vendor_cancel",
            referenceId: input.orderId,
            idempotencyKey: key,
            metaJson: {
              orderId: input.orderId,
              vendorId: input.vendorId,
              kind: "vendor_slice_cancel",
              refundAmount,
              walletRefund,
              stripeRefund,
            },
          },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: { increment: amountDec } },
        });
      }
    }

    await rollupOrderStatus(input.orderId, tx);

    const cancelWhere = { orderId_vendorId: { orderId: input.orderId, vendorId: input.vendorId } };
    return raceSafeUpsert({
      upsert: () =>
        tx.orderVendorCancellation.upsert({
          where: cancelWhere,
          create: {
            orderId: input.orderId,
            vendorId: input.vendorId,
            reason,
            cancelledSubtotal,
            cancelledShipping,
            cancelledDiscount,
            cancelledVat,
            refundAmount,
            status: "COMPLETED",
            createdByUserId: input.createdByUserId,
          },
          update: {
            reason,
            cancelledSubtotal,
            cancelledShipping,
            cancelledDiscount,
            cancelledVat,
            refundAmount,
            status: "COMPLETED",
            failureReason: null,
            createdByUserId: input.createdByUserId,
          },
        }),
      findUnique: () => tx.orderVendorCancellation.findUnique({ where: cancelWhere }),
    });
  });

  return {
    id: row.id,
    vendorId: row.vendorId,
    vendorName: vendor?.storeName ?? "",
    reason: row.reason,
    refundAmount: row.refundAmount.toString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
