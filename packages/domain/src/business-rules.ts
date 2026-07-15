export const settlementWindowDays = 7;
export const settlementWindowHours = settlementWindowDays * 24;

/** Days after delivery when returns are no longer allowed (customer + final invoice gate). */
export const returnWindowDays = 15;

export type MissingAncestorPolicy = "KEEP_BY_PLATFORM" | "REDISTRIBUTE_TO_EXISTING_LEVELS";

export const week1BusinessRules = {
  currency: "SAR",
  settlementWindowDays,
  missingAncestorPolicy: "KEEP_BY_PLATFORM" as MissingAncestorPolicy,
  defaultCommissionRates: {
    vendorRate: 0.7,
    platformRate: 0.3,
    cashbackRate: 0.05,
    affiliatePoolRate: 0.1,
    levelRates: [0.05, 0.02, 0.02, 0.01],
  },
  referralDepthMax: 4,
} as const;

/** Display ranks for affiliate profile (admin-assignable). */
export const affiliateRankTitles = ["Member", "Bronze", "Silver", "Gold", "Platinum"] as const;
export type AffiliateRankTitle = (typeof affiliateRankTitles)[number];

export const defaultAffiliateRankTitle: AffiliateRankTitle = "Member";

/** Default minimum wallet withdrawal (SAR). Env override used only before DB seed / fallback. */
export const defaultMinWithdrawalAmountSar = 250;

export function getMinWithdrawalAmountSarFromEnv(): number {
  const raw = process.env.MIN_WITHDRAWAL_AMOUNT_SAR;
  if (raw === undefined || raw.trim() === "") {
    return defaultMinWithdrawalAmountSar;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultMinWithdrawalAmountSar;
  }
  return Math.round(parsed * 100) / 100;
}

/** @deprecated Use async getMinWithdrawalAmountSar from platform-config.service */
export function getMinWithdrawalAmountSar(): number {
  return getMinWithdrawalAmountSarFromEnv();
}
