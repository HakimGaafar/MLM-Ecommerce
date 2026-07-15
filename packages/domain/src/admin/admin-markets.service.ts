import { prisma } from "@mlm/db";
import {
  DEFAULT_MARKET_CODE,
  getMarketDefinition,
  isMarketCode,
  type MarketCode,
} from "@mlm/shared";

export type AdminMarketDto = {
  id: string;
  code: MarketCode;
  subdomain: string;
  nameEn: string;
  nameAr: string;
  defaultCurrency: string;
  isActive: boolean;
  sortOrder: number;
  canDisable: boolean;
};

export async function listAdminMarkets(): Promise<AdminMarketDto[]> {
  try {
    const rows = await prisma.market.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        subdomain: true,
        nameEn: true,
        nameAr: true,
        defaultCurrency: true,
        isActive: true,
        sortOrder: true,
      },
    });
    if (rows.length > 0) {
      return rows
        .filter((row) => isMarketCode(row.code))
        .map((row) => ({
          id: row.id,
          code: row.code as MarketCode,
          subdomain: row.subdomain,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
          defaultCurrency: row.defaultCurrency,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          canDisable: row.code !== DEFAULT_MARKET_CODE,
        }));
    }
  } catch {
    // Table may not exist before migrate — fall back to static definitions.
  }

  const { listActiveMarketDefinitions } = await import("@mlm/shared");
  return listActiveMarketDefinitions().map((def) => ({
    id: `market_${def.code.toLowerCase()}`,
    code: def.code,
    subdomain: def.subdomain,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    defaultCurrency: def.defaultCurrency,
    isActive: true,
    sortOrder: def.sortOrder,
    canDisable: def.code !== DEFAULT_MARKET_CODE,
  }));
}

export async function setMarketActive(params: {
  marketCode: MarketCode;
  isActive: boolean;
}): Promise<AdminMarketDto> {
  if (params.marketCode === DEFAULT_MARKET_CODE && !params.isActive) {
    throw new Error("CANNOT_DISABLE_DEFAULT_MARKET");
  }

  const market = await prisma.market.findUnique({
    where: { code: params.marketCode },
    select: { id: true, code: true },
  });
  if (!market) {
    throw new Error("MARKET_NOT_FOUND");
  }

  if (!params.isActive) {
    const activeCount = await prisma.market.count({ where: { isActive: true } });
    const currentlyActive = await prisma.market.findUnique({
      where: { code: params.marketCode },
      select: { isActive: true },
    });
    if (currentlyActive?.isActive && activeCount <= 1) {
      throw new Error("LAST_ACTIVE_MARKET");
    }
  }

  const updated = await prisma.market.update({
    where: { id: market.id },
    data: { isActive: params.isActive },
    select: {
      id: true,
      code: true,
      subdomain: true,
      nameEn: true,
      nameAr: true,
      defaultCurrency: true,
      isActive: true,
      sortOrder: true,
    },
  });

  if (!isMarketCode(updated.code)) {
    throw new Error("MARKET_NOT_FOUND");
  }

  return {
    id: updated.id,
    code: updated.code,
    subdomain: updated.subdomain,
    nameEn: updated.nameEn,
    nameAr: updated.nameAr,
    defaultCurrency: updated.defaultCurrency,
    isActive: updated.isActive,
    sortOrder: updated.sortOrder,
    canDisable: updated.code !== DEFAULT_MARKET_CODE,
  };
}

export async function isMarketCodeActive(code: MarketCode): Promise<boolean> {
  try {
    const row = await prisma.market.findFirst({
      where: { code },
      select: { isActive: true },
    });
    if (row) return row.isActive;
  } catch {
    // fall through
  }
  return getMarketDefinition(code) !== undefined;
}
