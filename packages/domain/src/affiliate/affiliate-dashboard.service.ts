import { prisma } from "@mlm/db";
import { getAffiliateGenealogy, type GenealogyNodeDto } from "../admin/admin-affiliates.service";
import { listWalletTransactionsForUser, type WalletTransactionDto } from "../wallet/wallet.service";

export type { GenealogyNodeDto };

export type AffiliateDownlineMemberDto = {
  userId: string;
  name: string;
  joinedAt: string;
};

export type AffiliateCommissionRowDto = WalletTransactionDto & {
  orderId: string | null;
  orderNo: string | null;
  level: number | null;
};

export class AffiliateDashboardError extends Error {
  constructor(
    public readonly code: "NOT_ENROLLED",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AffiliateDashboardError";
  }
}

async function requireActiveAffiliate(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    select: { isActive: true, rankTitle: true, referralCode: true },
  });
  if (!profile?.isActive) {
    throw new AffiliateDashboardError("NOT_ENROLLED", "Affiliate profile is not active.");
  }
  return profile;
}

export async function getAffiliateGenealogyForUser(params: {
  userId: string;
  maxDepth?: number;
}): Promise<{ root: GenealogyNodeDto | null; maxDepth: number; truncated: boolean }> {
  await requireActiveAffiliate(params.userId);
  return getAffiliateGenealogy({
    rootUserId: params.userId,
    maxDepth: params.maxDepth ?? 3,
    maxNodes: 30,
  });
}

export async function listAffiliateDownlineForUser(params: {
  userId: string;
  page: number;
  pageSize: number;
}): Promise<{
  items: AffiliateDownlineMemberDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  await requireActiveAffiliate(params.userId);

  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [relations, total] = await prisma.$transaction([
    prisma.referralRelation.findMany({
      where: { parentUserId: params.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        child: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.referralRelation.count({ where: { parentUserId: params.userId } }),
  ]);

  return {
    items: relations.map((row) => ({
      userId: row.childUserId,
      name: row.child.user.name,
      joinedAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    hasMore: skip + relations.length < total,
  };
}

function commissionMetaFields(meta: Record<string, unknown> | null): {
  orderId: string | null;
  orderNo: string | null;
  level: number | null;
} {
  const orderId = typeof meta?.orderId === "string" ? meta.orderId : null;
  const orderNo = typeof meta?.orderNo === "string" ? meta.orderNo : null;
  const levelRaw = meta?.level;
  const level =
    typeof levelRaw === "number"
      ? levelRaw
      : typeof levelRaw === "string"
        ? Number(levelRaw)
        : null;
  return {
    orderId,
    orderNo,
    level: level != null && Number.isFinite(level) ? level : null,
  };
}

export async function listAffiliateCommissionsForUser(params: {
  userId: string;
  marketId: string;
  page: number;
  pageSize: number;
  locale?: "en" | "ar";
}): Promise<{
  items: AffiliateCommissionRowDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  await requireActiveAffiliate(params.userId);

  const result = await listWalletTransactionsForUser({
    userId: params.userId,
    marketId: params.marketId,
    page: params.page,
    pageSize: params.pageSize,
    locale: params.locale,
    entryType: "AFFILIATE_COMMISSION",
  });

  return {
    ...result,
    items: result.items.map((row) => {
      const fields = commissionMetaFields(row.meta);
      return { ...row, ...fields };
    }),
  };
}
