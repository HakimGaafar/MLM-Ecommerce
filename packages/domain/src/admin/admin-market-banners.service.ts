import { prisma } from "@mlm/db";
import type { AdminMarketBannerUpsertInput } from "@mlm/shared";

export type AdminMarketBannerDto = {
  id: string;
  marketId: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapRow(row: {
  id: string;
  marketId: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}): AdminMarketBannerDto {
  return { ...row };
}

export async function listAdminMarketBanners(marketId: string): Promise<AdminMarketBannerDto[]> {
  const rows = await prisma.marketBanner.findMany({
    where: { marketId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(mapRow);
}

export async function createAdminMarketBanner(params: {
  marketId: string;
  input: AdminMarketBannerUpsertInput;
}): Promise<AdminMarketBannerDto> {
  const row = await prisma.marketBanner.create({
    data: {
      marketId: params.marketId,
      titleEn: params.input.titleEn,
      titleAr: params.input.titleAr,
      subtitleEn: normalizeOptionalUrl(params.input.subtitleEn ?? null),
      subtitleAr: normalizeOptionalUrl(params.input.subtitleAr ?? null),
      imageUrl: normalizeOptionalUrl(params.input.imageUrl ?? null),
      linkUrl: normalizeOptionalUrl(params.input.linkUrl ?? null),
      sortOrder: params.input.sortOrder ?? 0,
      isActive: params.input.isActive ?? true,
    },
  });
  return mapRow(row);
}

export async function updateAdminMarketBanner(params: {
  bannerId: string;
  marketId: string;
  input: Partial<AdminMarketBannerUpsertInput>;
}): Promise<AdminMarketBannerDto> {
  const existing = await prisma.marketBanner.findFirst({
    where: { id: params.bannerId, marketId: params.marketId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const row = await prisma.marketBanner.update({
    where: { id: params.bannerId },
    data: {
      ...(params.input.titleEn !== undefined ? { titleEn: params.input.titleEn } : {}),
      ...(params.input.titleAr !== undefined ? { titleAr: params.input.titleAr } : {}),
      ...(params.input.subtitleEn !== undefined
        ? { subtitleEn: normalizeOptionalUrl(params.input.subtitleEn) }
        : {}),
      ...(params.input.subtitleAr !== undefined
        ? { subtitleAr: normalizeOptionalUrl(params.input.subtitleAr) }
        : {}),
      ...(params.input.imageUrl !== undefined
        ? { imageUrl: normalizeOptionalUrl(params.input.imageUrl) }
        : {}),
      ...(params.input.linkUrl !== undefined
        ? { linkUrl: normalizeOptionalUrl(params.input.linkUrl) }
        : {}),
      ...(params.input.sortOrder !== undefined ? { sortOrder: params.input.sortOrder } : {}),
      ...(params.input.isActive !== undefined ? { isActive: params.input.isActive } : {}),
    },
  });
  return mapRow(row);
}

export async function deleteAdminMarketBanner(params: {
  bannerId: string;
  marketId: string;
}): Promise<void> {
  const existing = await prisma.marketBanner.findFirst({
    where: { id: params.bannerId, marketId: params.marketId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");
  await prisma.marketBanner.delete({ where: { id: params.bannerId } });
}
