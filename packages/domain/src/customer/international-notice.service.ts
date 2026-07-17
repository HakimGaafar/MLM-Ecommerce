import { prisma } from "@mlm/db";
import { INTERNATIONAL_SHOPPING_NOTICE_VERSION } from "@mlm/shared";

export async function getInternationalShoppingNoticeStatus(
  userId: string,
): Promise<{
  accepted: boolean;
  acceptedAt: Date | null;
  version: string | null;
  currentVersion: string;
}> {
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: {
      internationalShoppingNoticeAcceptedAt: true,
      internationalShoppingNoticeVersion: true,
    },
  });
  const version = profile?.internationalShoppingNoticeVersion ?? null;
  return {
    accepted:
      profile?.internationalShoppingNoticeAcceptedAt != null &&
      version === INTERNATIONAL_SHOPPING_NOTICE_VERSION,
    acceptedAt: profile?.internationalShoppingNoticeAcceptedAt ?? null,
    version,
    currentVersion: INTERNATIONAL_SHOPPING_NOTICE_VERSION,
  };
}

export async function acceptInternationalShoppingNotice(userId: string): Promise<void> {
  await prisma.customerProfile.upsert({
    where: { userId },
    create: {
      userId,
      internationalShoppingNoticeAcceptedAt: new Date(),
      internationalShoppingNoticeVersion: INTERNATIONAL_SHOPPING_NOTICE_VERSION,
    },
    update: {
      internationalShoppingNoticeAcceptedAt: new Date(),
      internationalShoppingNoticeVersion: INTERNATIONAL_SHOPPING_NOTICE_VERSION,
    },
  });
}
