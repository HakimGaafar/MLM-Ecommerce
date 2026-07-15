export type KycExpiryWarning = "none" | "month" | "week" | "expired";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Yellow at ≤30 days, red at ≤7 days (IDs with expiry only). */
export function getKycExpiryWarning(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): KycExpiryWarning {
  if (!expiresAt) return "none";
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return "none";
  if (exp.getTime() <= now.getTime()) return "expired";
  const daysLeft = (exp.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysLeft <= 7) return "week";
  if (daysLeft <= 30) return "month";
  return "none";
}
