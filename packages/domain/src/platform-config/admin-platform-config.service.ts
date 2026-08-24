import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import type { AdminPlatformConfigUpdateInput, PaginatedResult } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import {
  getPlatformConfig,
  invalidatePlatformConfigCache,
  listPlatformConfigChangeLogs,
  percentToRate,
  toPlatformConfigAdminDto,
  type PlatformConfigAdminDto,
  type PlatformConfigChangeLogDto,
  type PlatformConfigSnapshot,
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

function buildChangeSummary(changes: Record<string, { from: unknown; to: unknown }>): string {
  const keys = Object.keys(changes);
  if (keys.length === 0) return "No changes";
  if (keys.length <= 3) return keys.join(", ");
  return `${keys.slice(0, 3).join(", ")} +${keys.length - 3} more`;
}

function diffConfig(
  before: PlatformConfigSnapshot,
  input: AdminPlatformConfigUpdateInput,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const pairs: [string, unknown, unknown][] = [
    ["cashbackRate", before.cashbackRate, percentToRate(input.cashbackPercent)],
    ["affiliatePoolRate", before.affiliatePoolRate, percentToRate(input.affiliatePoolPercent)],
    ["vendorRate", before.vendorRate, percentToRate(input.vendorPercent)],
    ["platformRate", before.platformRate, percentToRate(input.platformPercent)],
    ["vatRate", before.vatRate, percentToRate(input.vatPercent)],
    ["minWithdrawalAmount", before.minWithdrawalAmount, Math.round(input.minWithdrawalAmount * 100) / 100],
    ["returnWindowDays", before.returnWindowDays, input.returnWindowDays],
    ["settlementWindowDays", before.settlementWindowDays, input.settlementWindowDays],
    ["referralDepthMax", before.referralDepthMax, input.referralDepthMax],
    ["missingAncestorPolicy", before.missingAncestorPolicy, input.missingAncestorPolicy],
    ["showTapGateway", before.showTapGateway, input.showTapGateway],
    ["showHyperPayGateway", before.showHyperPayGateway, input.showHyperPayGateway],
    ["showMyFatoorahGateway", before.showMyFatoorahGateway, input.showMyFatoorahGateway],
  ];
  for (const [key, from, to] of pairs) {
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  const levelPercents = [
    input.affiliateLevel1Percent,
    input.affiliateLevel2Percent,
    input.affiliateLevel3Percent,
    input.affiliateLevel4Percent,
  ];
  for (let i = 0; i < 4; i += 1) {
    const from = before.affiliateLevelRates[i];
    const to = percentToRate(levelPercents[i] ?? 0);
    if (from !== to) changes[`affiliateLevel${i + 1}Rate`] = { from, to };
  }
  return changes;
}

export async function getAdminPlatformConfig(marketId: string): Promise<PlatformConfigAdminDto> {
  const market = await loadMarketForConfig(marketId);
  const snapshot = await getPlatformConfig(marketId);
  return toPlatformConfigAdminDto(snapshot, market);
}

export async function getAdminPlatformConfigChangeLogs(params: {
  marketId: string;
  limit?: number;
}): Promise<PlatformConfigChangeLogDto[]> {
  await loadMarketForConfig(params.marketId);
  return listPlatformConfigChangeLogs(params);
}

export async function listAdminPlatformConfigAudit(params: {
  marketId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<PlatformConfigChangeLogDto>> {
  if (params.marketId) {
    await loadMarketForConfig(params.marketId);
  }

  const { page, pageSize, skip, take } = normalizePagination(params);
  const where: Prisma.PlatformConfigChangeLogWhereInput = params.marketId
    ? { marketId: params.marketId }
    : {};

  const [rows, total] = await prisma.$transaction([
    prisma.platformConfigChangeLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.platformConfigChangeLog.count({ where }),
  ]);

  const marketIds = [...new Set(rows.map((row) => row.marketId))];
  const actorIds = [...new Set(rows.map((row) => row.actorUserId))];

  const [markets, actors] = await Promise.all([
    marketIds.length > 0
      ? prisma.market.findMany({
          where: { id: { in: marketIds } },
          select: { id: true, code: true, nameEn: true, nameAr: true },
        })
      : Promise.resolve([]),
    actorIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const marketById = new Map(markets.map((market) => [market.id, market]));
  const actorById = new Map(actors.map((actor) => [actor.id, actor.name]));

  const items: PlatformConfigChangeLogDto[] = rows.map((row) => {
    const market = marketById.get(row.marketId);
    return {
      id: row.id,
      marketId: row.marketId,
      marketCode: market?.code ?? row.marketId,
      marketNameEn: market?.nameEn ?? row.marketId,
      marketNameAr: market?.nameAr ?? row.marketId,
      actorUserId: row.actorUserId,
      actorName: actorById.get(row.actorUserId) ?? null,
      summary: row.summary,
      changesJson: row.changesJson as Record<string, { from: unknown; to: unknown }>,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return buildPaginatedResult(items, total, page, pageSize);
}

export async function updateAdminPlatformConfig(params: {
  marketId: string;
  actorUserId: string;
  input: AdminPlatformConfigUpdateInput;
}): Promise<PlatformConfigAdminDto> {
  const market = await loadMarketForConfig(params.marketId);
  const before = await getPlatformConfig(params.marketId);
  const changes = diffConfig(before, params.input);

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
    settlementWindowDays: params.input.settlementWindowDays,
    referralDepthMax: params.input.referralDepthMax,
    missingAncestorPolicy: params.input.missingAncestorPolicy,
    termsUrl: normalizeOptionalText(params.input.termsUrl),
    termsText: normalizeOptionalText(params.input.termsText),
    privacyUrl: normalizeOptionalText(params.input.privacyUrl),
    privacyText: normalizeOptionalText(params.input.privacyText),
    returnPolicyUrl: normalizeOptionalText(params.input.returnPolicyUrl),
    returnPolicyText: normalizeOptionalText(params.input.returnPolicyText),
    showTapGateway: params.input.showTapGateway,
    showHyperPayGateway: params.input.showHyperPayGateway,
    showMyFatoorahGateway: params.input.showMyFatoorahGateway,
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

  if (Object.keys(changes).length > 0) {
    await prisma.platformConfigChangeLog.create({
      data: {
        marketId: params.marketId,
        actorUserId: params.actorUserId,
        summary: buildChangeSummary(changes),
        changesJson: changes as Prisma.InputJsonValue,
      },
    });
  }

  invalidatePlatformConfigCache(params.marketId);
  const snapshot = await getPlatformConfig(params.marketId);
  return toPlatformConfigAdminDto(snapshot, market);
}
