import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import type { AdminPlatformConfigUpdateInput } from "@mlm/shared";
import {
  getPlatformConfig,
  invalidatePlatformConfigCache,
  percentToRate,
  toPlatformConfigAdminDto,
  type PlatformConfigAdminDto,
} from "./platform-config.service";

const CONFIG_IDS: Record<string, string> = {
  market_sa: "config_market_sa",
  market_om: "config_market_om",
  market_eg: "config_market_eg",
  market_global: "config_market_global",
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function loadMarketForConfig(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { id: true, code: true, defaultCurrency: true },
  });
  if (!market) {
    throw new Error("MARKET_NOT_FOUND");
  }
  return market;
}

export async function getAdminPlatformConfig(marketId: string): Promise<PlatformConfigAdminDto> {
  const market = await loadMarketForConfig(marketId);
  const snapshot = await getPlatformConfig(marketId);
  return toPlatformConfigAdminDto(snapshot, market);
}

export async function updateAdminPlatformConfig(params: {
  marketId: string;
  actorUserId: string;
  input: AdminPlatformConfigUpdateInput;
}): Promise<PlatformConfigAdminDto> {
  const market = await loadMarketForConfig(params.marketId);
  const data = {
    cashbackRate: new Prisma.Decimal(percentToRate(params.input.cashbackPercent)),
    affiliatePoolRate: new Prisma.Decimal(percentToRate(params.input.affiliatePoolPercent)),
    affiliateLevel1Rate: new Prisma.Decimal(percentToRate(params.input.affiliateLevel1Percent)),
    affiliateLevel2Rate: new Prisma.Decimal(percentToRate(params.input.affiliateLevel2Percent)),
    affiliateLevel3Rate: new Prisma.Decimal(percentToRate(params.input.affiliateLevel3Percent)),
    affiliateLevel4Rate: new Prisma.Decimal(percentToRate(params.input.affiliateLevel4Percent)),
    vendorRate: new Prisma.Decimal(percentToRate(params.input.vendorPercent)),
    platformRate: new Prisma.Decimal(percentToRate(params.input.platformPercent)),
    vatRate: new Prisma.Decimal(percentToRate(params.input.vatPercent)),
    minWithdrawalAmount: new Prisma.Decimal(
      Math.round(params.input.minWithdrawalAmount * 100) / 100,
    ),
    returnWindowDays: params.input.returnWindowDays,
    termsUrl: normalizeOptionalText(params.input.termsUrl),
    termsText: normalizeOptionalText(params.input.termsText),
    privacyUrl: normalizeOptionalText(params.input.privacyUrl),
    privacyText: normalizeOptionalText(params.input.privacyText),
    returnPolicyUrl: normalizeOptionalText(params.input.returnPolicyUrl),
    returnPolicyText: normalizeOptionalText(params.input.returnPolicyText),
    updatedByUserId: params.actorUserId,
  };

  await raceSafeUpsert({
    upsert: () =>
      prisma.platformConfig.upsert({
        where: { marketId: params.marketId },
        create: {
          id: CONFIG_IDS[params.marketId] ?? undefined,
          marketId: params.marketId,
          ...data,
        },
        update: data,
      }),
    findUnique: () => prisma.platformConfig.findUnique({ where: { marketId: params.marketId } }),
  });

  invalidatePlatformConfigCache(params.marketId);
  const snapshot = await getPlatformConfig(params.marketId);
  return toPlatformConfigAdminDto(snapshot, market);
}
