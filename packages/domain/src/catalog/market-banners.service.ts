import { prisma } from "@mlm/db";

export type MarketBannerDto = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
};

export async function listMarketBanners(params: {
  marketId: string;
  locale?: "en" | "ar";
  limit?: number;
}): Promise<MarketBannerDto[]> {
  const locale = params.locale ?? "en";
  const limit = Math.min(10, Math.max(1, params.limit ?? 5));

  const rows = await prisma.marketBanner.findMany({
    where: { marketId: params.marketId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    title: locale === "ar" ? row.titleAr : row.titleEn,
    subtitle: locale === "ar" ? row.subtitleAr : row.subtitleEn,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
  }));
}
