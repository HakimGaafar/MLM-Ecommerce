import { prisma } from "@mlm/db";

export async function listVandsoqWarehouses(activeOnly = true) {
  return prisma.vandsoqWarehouse.findMany({
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

export async function getVandsoqWarehouseByMarketId(marketId: string) {
  return prisma.vandsoqWarehouse.findUnique({
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
