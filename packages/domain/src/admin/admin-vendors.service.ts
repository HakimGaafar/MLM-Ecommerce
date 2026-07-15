import { prisma } from "@mlm/db";

export type AdminVendorListItemDto = {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
  createdAt: string;
};

export async function listAdminVendors(params: {
  page: number;
  pageSize: number;
  marketId: string;
}): Promise<{
  items: AdminVendorListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where: { marketId: params.marketId },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.vendor.count({ where: { marketId: params.marketId } }),
  ]);

  const items: AdminVendorListItemDto[] = rows.map((v) => ({
    id: v.id,
    storeName: v.storeName,
    ownerName: v.owner.name,
    ownerEmail: v.owner.email,
    productCount: v._count.products,
    createdAt: v.createdAt.toISOString(),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}
