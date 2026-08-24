import { prisma } from "@mlm/db";

export class AdminUserError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "ALREADY_ADMIN"
      | "NOT_ADMIN"
      | "FORBIDDEN"
      | "SELF_PROMOTE"
      | "CANNOT_DEMOTE_SUPER_ADMIN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AdminUserError";
  }
}

export type AdminUserListItemDto = {
  id: string;
  name: string;
  email: string;
  status: import("@mlm/db").UserStatus;
  roles: string[];
  createdAt: string;
};

function mapUserRow(u: {
  id: string;
  name: string;
  email: string;
  status: import("@mlm/db").UserStatus;
  createdAt: Date;
  userRoles: { role: { code: string } }[];
}): AdminUserListItemDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status,
    roles: u.userRoles.map((r) => r.role.code),
    createdAt: u.createdAt.toISOString(),
  };
}

async function assertActorIsSuperAdmin(actorUserId: string): Promise<void> {
  const actorRole = await prisma.userRole.findFirst({
    where: { userId: actorUserId, role: { code: "SUPER_ADMIN" } },
    select: { roleId: true },
  });
  if (!actorRole) {
    throw new AdminUserError("FORBIDDEN", "Only the super admin can promote coworkers to admin.");
  }
}

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

  return {
    items: rows.map(mapUserRow),
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

/** Grant ADMIN role to a coworker — SUPER_ADMIN only. */
export async function promoteUserToAdmin(params: {
  actorUserId: string;
  targetUserId: string;
}): Promise<AdminUserListItemDto> {
  await assertActorIsSuperAdmin(params.actorUserId);

  if (params.actorUserId === params.targetUserId) {
    throw new AdminUserError("SELF_PROMOTE", "Super admin already has full platform access.");
  }

  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!adminRole) {
    throw new AdminUserError("FORBIDDEN", "ADMIN role is not configured.");
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });
  if (!target) {
    throw new AdminUserError("NOT_FOUND", "User not found.");
  }

  if (target.userRoles.some((r) => r.role.code === "ADMIN")) {
    throw new AdminUserError("ALREADY_ADMIN", "This user is already an admin.");
  }

  await prisma.userRole.create({
    data: { userId: target.id, roleId: adminRole.id },
  });

  const refreshed = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });

  return mapUserRow(refreshed);
}

/** Revoke ADMIN role from a coworker — SUPER_ADMIN only. Does not remove SUPER_ADMIN. */
export async function demoteAdminUser(params: {
  actorUserId: string;
  targetUserId: string;
}): Promise<AdminUserListItemDto> {
  await assertActorIsSuperAdmin(params.actorUserId);

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      userRoles: { select: { role: { select: { code: true } }, roleId: true } },
    },
  });
  if (!target) {
    throw new AdminUserError("NOT_FOUND", "User not found.");
  }

  if (target.userRoles.some((r) => r.role.code === "SUPER_ADMIN")) {
    throw new AdminUserError(
      "CANNOT_DEMOTE_SUPER_ADMIN",
      "Super admin accounts cannot be demoted from this screen.",
    );
  }

  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (!adminRole) {
    throw new AdminUserError("FORBIDDEN", "ADMIN role is not configured.");
  }

  if (!target.userRoles.some((r) => r.role.code === "ADMIN")) {
    throw new AdminUserError("NOT_ADMIN", "This user is not an admin.");
  }

  await prisma.userRole.deleteMany({
    where: { userId: target.id, roleId: adminRole.id },
  });

  const refreshed = await prisma.user.findUniqueOrThrow({
    where: { id: target.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      userRoles: { select: { role: { select: { code: true } } } },
    },
  });

  return mapUserRow(refreshed);
}
