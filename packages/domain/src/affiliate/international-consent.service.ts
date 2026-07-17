import { prisma } from "@mlm/db";
import { INTERNATIONAL_MARKETING_AGREEMENT_VERSION } from "@mlm/shared";

export async function getInternationalMarketingAgreementStatus(
  userId: string,
): Promise<{
  exists: boolean;
  accepted: boolean;
  acceptedAt: Date | null;
  version: string | null;
  currentVersion: string;
}> {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    select: {
      internationalMarketingConsentAt: true,
      internationalMarketingConsentVersion: true,
    },
  });
  const version = profile?.internationalMarketingConsentVersion ?? null;
  return {
    exists: profile !== null,
    accepted:
      profile?.internationalMarketingConsentAt != null &&
      version === INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
    acceptedAt: profile?.internationalMarketingConsentAt ?? null,
    version,
    currentVersion: INTERNATIONAL_MARKETING_AGREEMENT_VERSION,
  };
}
