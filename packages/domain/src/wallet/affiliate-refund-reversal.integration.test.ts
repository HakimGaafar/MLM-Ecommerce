import { Prisma, prisma } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accrueAffiliateCommissionsForCompletedOrder } from "./affiliate-commission.service";
import { processReturnRefund } from "./wallet.service";

const RUN_INTEGRATION = Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN_INTEGRATION)("processReturnRefund — affiliate commission reversal (H3)", () => {
  const tag = `h3-${Date.now()}`;
  const sponsorEmail = `${tag}-sponsor@h3.test`;
  const buyerEmail = `${tag}-buyer@h3.test`;
  const orderNo = `ORD-H3-${tag}`;

  let sponsorId: string;
  let buyerId: string;
  let orderId: string;
  let returnId: string;
  let expectedLevel1Amount: number;

  beforeAll(async () => {
    const sponsor = await prisma.user.create({
      data: {
        name: "H3 Sponsor",
        email: sponsorEmail,
        passwordHash: "test-hash",
        affiliateProfile: {
          create: { referralCode: `SP${tag.slice(-10)}`, isActive: true },
        },
        wallets: { create: { marketId: DEFAULT_MARKET_ID, currency: "SAR" } },
      },
    });
    sponsorId = sponsor.id;

    const buyer = await prisma.user.create({
      data: {
        name: "H3 Buyer",
        email: buyerEmail,
        passwordHash: "test-hash",
        affiliateProfile: {
          create: { referralCode: `BY${tag.slice(-10)}`, isActive: true },
        },
        wallets: { create: { marketId: DEFAULT_MARKET_ID, currency: "SAR" } },
      },
    });
    buyerId = buyer.id;

    await prisma.referralRelation.create({
      data: { childUserId: buyerId, parentUserId: sponsorId },
    });

    const order = await prisma.order.create({
      data: {
        marketId: DEFAULT_MARKET_ID,
        buyerUserId: buyerId,
        orderNo,
        status: "COMPLETED",
        paymentStatus: "PAID",
        subtotal: new Prisma.Decimal(100),
        discountTotal: new Prisma.Decimal(0),
        shippingFee: new Prisma.Decimal(0),
        vatTotal: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(100),
        paymentMethod: "COD",
        checkoutIdempotencyKey: `h3-checkout-${tag}`,
      },
    });
    orderId = order.id;

    await accrueAffiliateCommissionsForCompletedOrder(orderId);

    const accrual = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey: `affiliate:order:${orderId}:level:1` },
    });
    expect(accrual?.direction).toBe("CREDIT");
    expect(accrual?.status).toBe("PENDING");
    expectedLevel1Amount = Number(accrual!.amount);

    const orderReturn = await prisma.orderReturn.create({
      data: {
        orderId,
        buyerUserId: buyerId,
        status: "REFUND_COMPLETED",
        reason: "DEFECTIVE",
        details: "H3 integration test return",
        policyAcceptedAt: new Date(),
      },
    });
    returnId = orderReturn.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [sponsorEmail, buyerEmail] } },
    });
  });

  it("posts a debit reversal and reduces sponsor pending balance", async () => {
    const walletBefore = await prisma.wallet.findUniqueOrThrow({
      where: { userId_marketId: { userId: sponsorId, marketId: DEFAULT_MARKET_ID } },
    });
    const pendingBefore = Number(walletBefore.pendingBalance);
    expect(pendingBefore).toBeGreaterThanOrEqual(expectedLevel1Amount);

    await processReturnRefund(returnId);

    const reversal = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey: `affiliate-reversal:return:${returnId}:level:1` },
    });
    expect(reversal).not.toBeNull();
    expect(reversal?.entryType).toBe("AFFILIATE_COMMISSION");
    expect(reversal?.direction).toBe("DEBIT");
    expect(reversal?.status).toBe("PENDING");
    expect(Number(reversal?.amount)).toBe(expectedLevel1Amount);

    const accrualAfter = await prisma.walletTransaction.findUnique({
      where: { idempotencyKey: `affiliate:order:${orderId}:level:1` },
    });
    expect(accrualAfter?.status).toBe("REVERSED");

    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId_marketId: { userId: sponsorId, marketId: DEFAULT_MARKET_ID } },
    });
    expect(Number(walletAfter.pendingBalance)).toBe(
      round2(pendingBefore - expectedLevel1Amount),
    );
  });

  it("does not duplicate reversal rows when run again", async () => {
    await processReturnRefund(returnId);

    const reversals = await prisma.walletTransaction.findMany({
      where: {
        idempotencyKey: { startsWith: `affiliate-reversal:return:${returnId}:` },
      },
    });
    expect(reversals).toHaveLength(1);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
