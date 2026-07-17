import { prisma } from "@mlm/db";
import { DEFAULT_MARKET_ID } from "@mlm/shared";
import {
  returnWindowDays as defaultReturnWindowDays,
  week1BusinessRules,
  getMinWithdrawalAmountSarFromEnv,
} from "../business-rules";

const CACHE_TTL_MS = 30_000;
const DEFAULT_VAT_RATE = 0.15;

export type PlatformConfigSnapshot = {
  marketId: string;
  cashbackRate: number;
  affiliatePoolRate: number;
  affiliateLevelRates: [number, number, number, number];
  vendorRate: number;
  platformRate: number;
  vatRate: number;
  minWithdrawalAmount: number;
  returnWindowDays: number;
  termsUrl: string | null;
  termsText: string | null;
  privacyUrl: string | null;
  privacyText: string | null;
  returnPolicyUrl: string | null;
  returnPolicyText: string | null;
  showTapGateway: boolean;
  showHyperPayGateway: boolean;
  showMyFatoorahGateway: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type PlatformConfigAdminDto = PlatformConfigSnapshot & {
  marketCode: string;
  currency: string;
  cashbackPercent: number;
  affiliatePoolPercent: number;
  affiliateLevelPercents: [number, number, number, number];
  vendorPercent: number;
  platformPercent: number;
  vatPercent: number;
};

const cache = new Map<string, { data: PlatformConfigSnapshot; expiresAt: number }>();

function roundRate(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function toPercent(rate: number): number {
  return Math.round(rate * 1000) / 10;
}

export function getDefaultPlatformConfigSnapshot(marketId: string = DEFAULT_MARKET_ID): PlatformConfigSnapshot {
  const rates = week1BusinessRules.defaultCommissionRates;
  const levelRates = rates.levelRates as [number, number, number, number];
  return {
    marketId,
    cashbackRate: rates.cashbackRate,
    affiliatePoolRate: rates.affiliatePoolRate,
    affiliateLevelRates: [...levelRates] as [number, number, number, number],
    vendorRate: rates.vendorRate,
    platformRate: rates.platformRate,
    vatRate: DEFAULT_VAT_RATE,
    minWithdrawalAmount: getMinWithdrawalAmountSarFromEnv(),
    returnWindowDays: defaultReturnWindowDays,
    termsUrl: null,
    termsText: null,
    privacyUrl: null,
    privacyText: null,
    returnPolicyUrl: null,
    returnPolicyText: null,
    showTapGateway: true,
    showHyperPayGateway: true,
    showMyFatoorahGateway: true,
    updatedAt: null,
    updatedByUserId: null,
  };
}

function mapRow(row: {
  marketId: string;
  cashbackRate: { toString(): string };
  affiliatePoolRate: { toString(): string };
  affiliateLevel1Rate: { toString(): string };
  affiliateLevel2Rate: { toString(): string };
  affiliateLevel3Rate: { toString(): string };
  affiliateLevel4Rate: { toString(): string };
  vendorRate: { toString(): string };
  platformRate: { toString(): string };
  vatRate: { toString(): string };
  minWithdrawalAmount: { toString(): string };
  returnWindowDays: number;
  termsUrl: string | null;
  termsText: string | null;
  privacyUrl: string | null;
  privacyText: string | null;
  returnPolicyUrl: string | null;
  returnPolicyText: string | null;
  showTapGateway: boolean;
  showHyperPayGateway: boolean;
  showMyFatoorahGateway: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}): PlatformConfigSnapshot {
  return {
    marketId: row.marketId,
    cashbackRate: Number(row.cashbackRate),
    affiliatePoolRate: Number(row.affiliatePoolRate),
    affiliateLevelRates: [
      Number(row.affiliateLevel1Rate),
      Number(row.affiliateLevel2Rate),
      Number(row.affiliateLevel3Rate),
      Number(row.affiliateLevel4Rate),
    ],
    vendorRate: Number(row.vendorRate),
    platformRate: Number(row.platformRate),
    vatRate: Number(row.vatRate),
    minWithdrawalAmount: Number(row.minWithdrawalAmount),
    returnWindowDays: row.returnWindowDays,
    termsUrl: row.termsUrl,
    termsText: row.termsText,
    privacyUrl: row.privacyUrl,
    privacyText: row.privacyText,
    returnPolicyUrl: row.returnPolicyUrl,
    returnPolicyText: row.returnPolicyText,
    showTapGateway: row.showTapGateway,
    showHyperPayGateway: row.showHyperPayGateway,
    showMyFatoorahGateway: row.showMyFatoorahGateway,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

export function toPlatformConfigAdminDto(
  snapshot: PlatformConfigSnapshot,
  market: { code: string; defaultCurrency: string },
): PlatformConfigAdminDto {
  return {
    ...snapshot,
    marketCode: market.code,
    currency: market.defaultCurrency,
    cashbackPercent: toPercent(snapshot.cashbackRate),
    affiliatePoolPercent: toPercent(snapshot.affiliatePoolRate),
    affiliateLevelPercents: snapshot.affiliateLevelRates.map((r) => toPercent(r)) as [
      number,
      number,
      number,
      number,
    ],
    vendorPercent: toPercent(snapshot.vendorRate),
    platformPercent: toPercent(snapshot.platformRate),
    vatPercent: toPercent(snapshot.vatRate),
  };
}

export function invalidatePlatformConfigCache(marketId?: string): void {
  if (marketId) {
    cache.delete(marketId);
    return;
  }
  cache.clear();
}

export async function getPlatformConfig(marketId: string = DEFAULT_MARKET_ID): Promise<PlatformConfigSnapshot> {
  const cached = cache.get(marketId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const row = await prisma.platformConfig.findUnique({ where: { marketId } });
  const data = row ? mapRow(row) : getDefaultPlatformConfigSnapshot(marketId);
  cache.set(marketId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function getMinWithdrawalAmount(marketId: string = DEFAULT_MARKET_ID): Promise<number> {
  const config = await getPlatformConfig(marketId);
  return config.minWithdrawalAmount;
}

/** @deprecated Use getMinWithdrawalAmount(marketId) */
export async function getMinWithdrawalAmountSar(marketId: string = DEFAULT_MARKET_ID): Promise<number> {
  return getMinWithdrawalAmount(marketId);
}

export async function getReturnWindowDays(marketId: string = DEFAULT_MARKET_ID): Promise<number> {
  const config = await getPlatformConfig(marketId);
  return config.returnWindowDays;
}

export async function getVatRate(marketId: string = DEFAULT_MARKET_ID): Promise<number> {
  const config = await getPlatformConfig(marketId);
  return config.vatRate;
}

export function percentToRate(percent: number): number {
  return roundRate(percent / 100);
}

export function buildPlatformConfigSeedData(
  marketId: string,
  overrides?: Partial<PlatformConfigSnapshot>,
): Omit<PlatformConfigSnapshot, "updatedAt" | "updatedByUserId"> {
  const defaults = getDefaultPlatformConfigSnapshot(marketId);
  return {
    marketId,
    cashbackRate: overrides?.cashbackRate ?? defaults.cashbackRate,
    affiliatePoolRate: overrides?.affiliatePoolRate ?? defaults.affiliatePoolRate,
    affiliateLevelRates: overrides?.affiliateLevelRates ?? defaults.affiliateLevelRates,
    vendorRate: overrides?.vendorRate ?? defaults.vendorRate,
    platformRate: overrides?.platformRate ?? defaults.platformRate,
    vatRate: overrides?.vatRate ?? defaults.vatRate,
    minWithdrawalAmount: overrides?.minWithdrawalAmount ?? defaults.minWithdrawalAmount,
    returnWindowDays: overrides?.returnWindowDays ?? defaults.returnWindowDays,
    termsUrl: overrides?.termsUrl ?? defaults.termsUrl,
    termsText: overrides?.termsText ?? defaults.termsText,
    privacyUrl: overrides?.privacyUrl ?? defaults.privacyUrl,
    privacyText: overrides?.privacyText ?? defaults.privacyText,
    returnPolicyUrl: overrides?.returnPolicyUrl ?? defaults.returnPolicyUrl,
    returnPolicyText: overrides?.returnPolicyText ?? defaults.returnPolicyText,
    showTapGateway: overrides?.showTapGateway ?? defaults.showTapGateway,
    showHyperPayGateway: overrides?.showHyperPayGateway ?? defaults.showHyperPayGateway,
    showMyFatoorahGateway:
      overrides?.showMyFatoorahGateway ?? defaults.showMyFatoorahGateway,
  };
}
