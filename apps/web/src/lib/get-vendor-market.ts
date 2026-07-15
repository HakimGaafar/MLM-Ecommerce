import { prisma } from "@mlm/db";

export async function getVendorMarketId(vendorId: string): Promise<string | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { marketId: true },
  });
  return vendor?.marketId ?? null;
}
