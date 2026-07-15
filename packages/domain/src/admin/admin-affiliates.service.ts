import { Prisma, prisma } from "@mlm/db";
import {
  affiliateRankTitles,
  defaultAffiliateRankTitle,
  week1BusinessRules,
} from "../business-rules";

export type AdminAffiliateListItemDto = {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  rankTitle: string;
  isActive: boolean;
  directReferrals: number;
  commissionPending: string;
  commissionApproved: string;
  createdAt: string;
};

export type AdminAffiliateDetailDto = {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  rankTitle: string;
  isActive: boolean;
  sponsorUserId: string | null;
  sponsorName: string | null;
  directReferrals: number;
  commissionPending: string;
  commissionApproved: string;
  createdAt: string;
};

export type GenealogyNodeDto = {
  userId: string;
  name: string;
  referralCode: string;
  rankTitle: string;
  depth: number;
  joinedAt: string;
  directReferrals: number;
  children: GenealogyNodeDto[];
};

export class AdminAffiliateError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "INVALID_RANK",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminAffiliateError";
  }
}

async function batchSumAffiliateCommissions(
  userIds: string[],
): Promise<Map<string, { pending: number; approved: number }>> {
  const result = new Map<string, { pending: number; approved: number }>();
  if (userIds.length === 0) return result;

  for (const userId of userIds) {
    result.set(userId, { pending: 0, approved: 0 });
  }

  const rows = await prisma.walletTransaction.groupBy({
    by: ["userId", "status"],
    where: {
      userId: { in: userIds },
      entryType: "AFFILIATE_COMMISSION",
      direction: "CREDIT",
      status: { in: ["PENDING", "APPROVED"] },
    },
    _sum: { amount: true },
  });

  for (const row of rows) {
    const current = result.get(row.userId) ?? { pending: 0, approved: 0 };
    const amount = Number(row._sum.amount ?? 0);
    if (row.status === "PENDING") current.pending = amount;
    if (row.status === "APPROVED") current.approved = amount;
    result.set(row.userId, current);
  }

  return result;
}

async function sumAffiliateCommissions(userId: string): Promise<{
  pending: number;
  approved: number;
}> {
  const map = await batchSumAffiliateCommissions([userId]);
  return map.get(userId) ?? { pending: 0, approved: 0 };
}

export async function listAdminAffiliates(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<{
  items: AdminAffiliateListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;
  const search = params.search?.trim();

  const where: Prisma.AffiliateProfileWhereInput = search
    ? {
        OR: [
          { referralCode: { contains: search, mode: "insensitive" } },
          { user: { name: { contains: search, mode: "insensitive" } } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [profiles, total] = await prisma.$transaction([
    prisma.affiliateProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { children: true } },
      },
    }),
    prisma.affiliateProfile.count({ where }),
  ]);

  const commissionByUser = await batchSumAffiliateCommissions(profiles.map((p) => p.userId));

  const items: AdminAffiliateListItemDto[] = profiles.map((profile) => {
    const sums = commissionByUser.get(profile.userId) ?? { pending: 0, approved: 0 };
    return {
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      referralCode: profile.referralCode,
      rankTitle: profile.rankTitle,
      isActive: profile.isActive,
      directReferrals: profile._count.children,
      commissionPending: sums.pending.toFixed(2),
      commissionApproved: sums.approved.toFixed(2),
      createdAt: profile.createdAt.toISOString(),
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + profiles.length < total,
  };
}

export async function getAdminAffiliateDetail(userId: string): Promise<AdminAffiliateDetailDto | null> {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true } },
      parent: {
        include: {
          parent: {
            include: { user: { select: { name: true } } },
          },
        },
      },
      _count: { select: { children: true } },
    },
  });
  if (!profile) return null;

  const sums = await sumAffiliateCommissions(profile.userId);
  const sponsor = profile.parent?.parent;

  return {
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    referralCode: profile.referralCode,
    rankTitle: profile.rankTitle,
    isActive: profile.isActive,
    sponsorUserId: sponsor?.userId ?? null,
    sponsorName: sponsor?.user.name ?? null,
    directReferrals: profile._count.children,
    commissionPending: sums.pending.toFixed(2),
    commissionApproved: sums.approved.toFixed(2),
    createdAt: profile.createdAt.toISOString(),
  };
}

export async function updateAdminAffiliateRank(params: {
  userId: string;
  rankTitle: string;
}): Promise<AdminAffiliateDetailDto> {
  const normalized = params.rankTitle.trim();
  if (!affiliateRankTitles.includes(normalized as (typeof affiliateRankTitles)[number])) {
    throw new AdminAffiliateError("INVALID_RANK", "Invalid rank title.");
  }

  const existing = await prisma.affiliateProfile.findUnique({ where: { userId: params.userId } });
  if (!existing) {
    throw new AdminAffiliateError("NOT_FOUND", "Affiliate not found.");
  }

  await prisma.affiliateProfile.update({
    where: { userId: params.userId },
    data: { rankTitle: normalized },
  });

  const detail = await getAdminAffiliateDetail(params.userId);
  if (!detail) {
    throw new AdminAffiliateError("NOT_FOUND", "Affiliate not found.");
  }
  return detail;
}

async function loadGenealogyChildrenBfs(params: {
  rootUserId: string;
  maxDepth: number;
  maxNodes: number;
}): Promise<GenealogyNodeDto[]> {
  const nodeById = new Map<string, GenealogyNodeDto>();
  const rootChildren: GenealogyNodeDto[] = [];
  let frontier = [params.rootUserId];
  let nodeCount = 0;

  for (let depth = 0; depth < params.maxDepth && frontier.length > 0 && nodeCount < params.maxNodes; depth++) {
    const relations = await prisma.referralRelation.findMany({
      where: { parentUserId: { in: frontier } },
      orderBy: { createdAt: "asc" },
      include: {
        child: {
          include: {
            user: { select: { name: true } },
            _count: { select: { children: true } },
          },
        },
      },
    });

    const nextFrontier: string[] = [];
    for (const relation of relations) {
      if (nodeCount >= params.maxNodes) break;
      if (nodeById.has(relation.childUserId)) continue;

      const node: GenealogyNodeDto = {
        userId: relation.childUserId,
        name: relation.child.user.name,
        referralCode: relation.child.referralCode,
        rankTitle: relation.child.rankTitle,
        depth: depth + 1,
        joinedAt: relation.createdAt.toISOString(),
        directReferrals: relation.child._count.children,
        children: [],
      };
      nodeById.set(relation.childUserId, node);

      if (relation.parentUserId === params.rootUserId) {
        rootChildren.push(node);
      } else {
        const parent = nodeById.get(relation.parentUserId);
        if (parent) parent.children.push(node);
      }

      nextFrontier.push(relation.childUserId);
      nodeCount += 1;
    }

    frontier = nextFrontier;
  }

  return rootChildren;
}

export async function getAffiliateGenealogy(params: {
  rootUserId: string;
  maxDepth?: number;
  maxNodes?: number;
}): Promise<{ root: GenealogyNodeDto | null; maxDepth: number; truncated: boolean }> {
  const maxDepth = Math.min(
    week1BusinessRules.referralDepthMax,
    Math.max(1, params.maxDepth ?? 3),
  );
  const maxNodes = Math.min(100, Math.max(1, params.maxNodes ?? 40));

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: params.rootUserId },
    include: {
      user: { select: { name: true } },
      _count: { select: { children: true } },
    },
  });
  if (!profile) {
    return { root: null, maxDepth, truncated: false };
  }

  const children = await loadGenealogyChildrenBfs({
    rootUserId: profile.userId,
    maxDepth,
    maxNodes,
  });

  const nodeCount = 1 + countGenealogyNodes(children);

  return {
    root: {
      userId: profile.userId,
      name: profile.user.name,
      referralCode: profile.referralCode,
      rankTitle: profile.rankTitle,
      depth: 0,
      joinedAt: profile.createdAt.toISOString(),
      directReferrals: profile._count.children,
      children,
    },
    maxDepth,
    truncated: nodeCount >= maxNodes,
  };
}

function countGenealogyNodes(nodes: GenealogyNodeDto[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    count += countGenealogyNodes(node.children);
  }
  return count;
}

export { defaultAffiliateRankTitle, affiliateRankTitles };
