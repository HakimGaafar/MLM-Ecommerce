import type { UserStatus } from "@mlm/db";
import { prisma } from "@mlm/db";

export type AdminUserListItemDto = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  roles: string[];
  createdAt: string;
};

export async function listAdminUsers(params: {
  page: number;
  pageSize: number;
}): Promise<{
  items: AdminUserListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(50, Math.max(1, params.pageSize));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    }),
    prisma.user.count(),
  ]);

  const items: AdminUserListItemDto[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    roles: u.userRoles.map((r) => r.role.code),
    createdAt: u.createdAt.toISOString(),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}
