import { prisma } from "@mlm/db";

export class ReferralBindError extends Error {
  constructor(
    public readonly code: "ALREADY_BOUND" | "HAS_ORDERS",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ReferralBindError";
  }
}

/**
 * Referral parent is set once at registration. A child with any order cannot be bound.
 */
export async function assertChildCanReceiveReferral(childUserId: string): Promise<void> {
  const existing = await prisma.referralRelation.findUnique({
    where: { childUserId },
    select: { childUserId: true },
  });
  if (existing) {
    throw new ReferralBindError("ALREADY_BOUND", "Referral parent is already set.");
  }

  const orderCount = await prisma.order.count({
    where: { buyerUserId: childUserId },
  });
  if (orderCount > 0) {
    throw new ReferralBindError(
      "HAS_ORDERS",
      "Referral cannot be set after the customer has placed an order.",
    );
  }
}
