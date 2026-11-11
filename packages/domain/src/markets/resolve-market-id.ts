import { prisma } from "@mlm/db";
import { getMarketId, isMarketCodeFormat, isSeedMarketCode } from "@mlm/shared";

/**
 * Resolve any market code (seed SA/OM/EG/GLOBAL or wizard AE/…) to DB id.
 * Prefer static MARKET_IDS for seed codes, then Prisma for DB-created markets.
 */
export async function resolveMarketIdByCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  if (!isMarketCodeFormat(normalized)) {
    throw new Error("MARKET_NOT_FOUND");
  }
  if (isSeedMarketCode(normalized)) {
    return getMarketId(normalized);
  }
  const row = await prisma.market.findUnique({
    where: { code: normalized },
    select: { id: true },
  });
  if (!row) throw new Error("MARKET_NOT_FOUND");
  return row.id;
}

export async function resolveMarketIdByCodeOrNull(
  code: string | null | undefined,
): Promise<string | null> {
  if (!code?.trim()) return null;
  try {
    return await resolveMarketIdByCode(code);
  } catch {
    return null;
  }
}
