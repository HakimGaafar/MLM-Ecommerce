import { slugifyStoreName } from "@mlm/shared";
import type { Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";

type Db = Prisma.TransactionClient | typeof prisma;

export function normalizeProductSlug(raw: string): string {
  const base = slugifyStoreName(raw).slice(0, 80);
  return base.length >= 2 ? base : `product-${Date.now().toString(36)}`.slice(0, 80);
}

/** Allocate a market-unique product slug, appending a short suffix on collision. */
export async function allocateProductSlug(
  marketId: string,
  desired: string,
  db: Db = prisma,
  excludeProductId?: string,
): Promise<string> {
  let base = normalizeProductSlug(desired);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 72)}-${i + 1}`;
    const existing = await db.product.findFirst({
      where: {
        marketId,
        slug: candidate,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base.slice(0, 60)}-${Date.now().toString(36)}`.slice(0, 80);
}

export function looksLikeProductId(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value);
}
