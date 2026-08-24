import type { Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";

export class ReferralBindError extends Error {
  constructor(
    public readonly code: "ALREADY_BOUND" | "HAS_ORDERS" | "INVALID_REFERRAL_CODE" | "SELF_REFERRAL_BLOCKED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ReferralBindError";
  }
}

export function referralCodeSeedFromEmail(email: string, userId: string): string {
  const base = (email.split("@")[0] ?? "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `${base || "USER"}${userId.slice(-4)}`;
}

/**
 * Stores referral parent at registration. Creates an inactive affiliate profile when needed
 * so the relation can be recorded before the user opts into the marketer program.
 */
export async function bindReferralAtRegistration(
  tx: Prisma.TransactionClient,
  params: {
    childUserId: string;
    childEmail: string;
    referralCode: string;
  },
): Promise<void> {
  await assertChildCanReceiveReferral(params.childUserId);

  const parent = await tx.affiliateProfile.findUnique({
    where: { referralCode: params.referralCode },
    select: { userId: true },
  });
  if (!parent) {
    throw new ReferralBindError("INVALID_REFERRAL_CODE", "Referral code is invalid.");
  }
  if (parent.userId === params.childUserId) {
    throw new ReferralBindError("SELF_REFERRAL_BLOCKED", "You cannot refer yourself.");
  }

  const existingProfile = await tx.affiliateProfile.findUnique({
    where: { userId: params.childUserId },
    select: { userId: true },
  });
  if (!existingProfile) {
    await tx.affiliateProfile.create({
      data: {
        userId: params.childUserId,
        referralCode: referralCodeSeedFromEmail(params.childEmail, params.childUserId),
        isActive: false,
      },
    });
  }

  await tx.referralRelation.create({
    data: {
      childUserId: params.childUserId,
      parentUserId: parent.userId,
    },
  });
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
