import { prisma } from "@mlm/db";

export async function listFourcesWarehouses(activeOnly = true) {
  return prisma.fourcesWarehouse.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { countryCode: "asc" },
    select: {
      id: true,
      marketId: true,
      countryCode: true,
      name: true,
      isActive: true,
    },
  });
}

export async function getFourcesWarehouseByMarketId(marketId: string) {
  return prisma.fourcesWarehouse.findUnique({
    where: { marketId },
    select: {
      id: true,
      marketId: true,
      countryCode: true,
      name: true,
      isActive: true,
    },
  });
}
