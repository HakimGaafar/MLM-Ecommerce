import { prisma } from "@mlm/db";

export async function getVendorIdForOwner(ownerUserId: string): Promise<string | null> {
  const row = await prisma.vendor.findFirst({
    where: { ownerUserId },
    select: { id: true },
  });
  return row?.id ?? null;
}
