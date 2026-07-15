import { randomUUID } from "node:crypto";
import type { PaginatedResult, VendorPermissionCode, VendorTeamInviteInput } from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { prisma } from "@mlm/db";
import { isVendorOwner } from "./vendor-access.service";

export type VendorTeamMemberDto = {
  id: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  userName: string | null;
  permissions: VendorPermissionCode[];
  createdAt: string;
  inviteLink?: string;
};

export class VendorTeamError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "DUPLICATE"
      | "EMAIL_MISMATCH"
      | "ALREADY_ACCEPTED"
      | "REVOKED"
      | "INVALID",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VendorTeamError";
  }
}

function memberToDto(
  row: {
    id: string;
    email: string;
    status: string;
    inviteToken: string;
    createdAt: Date;
    user: { name: string } | null;
    permissions: { code: string }[];
  },
  opts?: { includeInviteLink: boolean },
): VendorTeamMemberDto {
  return {
    id: row.id,
    email: row.email,
    status: row.status as VendorTeamMemberDto["status"],
    userName: row.user?.name ?? null,
    permissions: row.permissions.map((p) => p.code as VendorPermissionCode),
    createdAt: row.createdAt.toISOString(),
    ...(opts?.includeInviteLink && row.status === "PENDING"
      ? { inviteLink: `/team/accept?token=${row.inviteToken}` }
      : {}),
  };
}

export async function listVendorTeam(
  vendorId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<VendorTeamMemberDto>> {
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { vendorId, status: { not: "REVOKED" as const } };
  const [rows, total] = await prisma.$transaction([
    prisma.vendorMember.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        email: true,
        status: true,
        inviteToken: true,
        createdAt: true,
        user: { select: { name: true } },
        permissions: { select: { code: true } },
      },
    }),
    prisma.vendorMember.count({ where }),
  ]);
  return buildPaginatedResult(
    rows.map((r) => memberToDto(r, { includeInviteLink: true })),
    total,
    page,
    pageSize,
  );
}

export async function createVendorTeamInvite(
  vendorId: string,
  invitedByUserId: string,
  input: VendorTeamInviteInput,
): Promise<VendorTeamMemberDto> {
  const owner = await isVendorOwner(vendorId, invitedByUserId);
  if (!owner) {
    const { assertVendorPermission } = await import("./vendor-permissions.service");
    await assertVendorPermission(vendorId, "vendor:team:edit", invitedByUserId);
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { owner: { select: { email: true } } },
  });
  if (!vendor) {
    throw new VendorTeamError("NOT_FOUND", "Store not found.");
  }

  const email = input.email.trim().toLowerCase();
  if (email === vendor.owner.email.toLowerCase()) {
    throw new VendorTeamError("INVALID", "The store owner is already on the team.");
  }

  const existing = await prisma.vendorMember.findUnique({
    where: { vendorId_email: { vendorId, email } },
  });
  if (existing && existing.status !== "REVOKED") {
    throw new VendorTeamError("DUPLICATE", "This email already has a pending or active invite.");
  }

  const token = randomUUID().replace(/-/g, "");
  const uniquePerms = [...new Set(input.permissions)];

  if (existing?.status === "REVOKED") {
    await prisma.vendorMemberPermission.deleteMany({ where: { memberId: existing.id } });
    const row = await prisma.vendorMember.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        userId: null,
        inviteToken: token,
        invitedByUserId,
        permissions: {
          create: uniquePerms.map((code) => ({ code })),
        },
      },
      select: {
        id: true,
        email: true,
        status: true,
        inviteToken: true,
        createdAt: true,
        user: { select: { name: true } },
        permissions: { select: { code: true } },
      },
    });
    return memberToDto(row, { includeInviteLink: true });
  }

  const row = await prisma.vendorMember.create({
    data: {
      vendorId,
      email,
      status: "PENDING",
      inviteToken: token,
      invitedByUserId,
      permissions: {
        create: uniquePerms.map((code) => ({ code })),
      },
    },
    select: {
      id: true,
      email: true,
      status: true,
      inviteToken: true,
      createdAt: true,
      user: { select: { name: true } },
      permissions: { select: { code: true } },
    },
  });

  return memberToDto(row, { includeInviteLink: true });
}

export async function revokeVendorTeamMember(
  vendorId: string,
  memberId: string,
  actorUserId: string,
): Promise<void> {
  const owner = await isVendorOwner(vendorId, actorUserId);
  if (!owner) {
    const { assertVendorPermission } = await import("./vendor-permissions.service");
    await assertVendorPermission(vendorId, "vendor:team:edit", actorUserId);
  }

  const member = await prisma.vendorMember.findFirst({
    where: { id: memberId, vendorId },
  });
  if (!member) {
    throw new VendorTeamError("NOT_FOUND", "Team member not found.");
  }

  await prisma.vendorMember.update({
    where: { id: memberId },
    data: { status: "REVOKED", userId: null },
  });
}

export type VendorInvitePreviewDto = {
  storeName: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
};

export async function getVendorInvitePreview(token: string): Promise<VendorInvitePreviewDto | null> {
  const row = await prisma.vendorMember.findUnique({
    where: { inviteToken: token },
    select: {
      email: true,
      status: true,
      vendor: { select: { storeName: true } },
    },
  });
  if (!row) return null;
  return {
    storeName: row.vendor.storeName,
    email: row.email,
    status: row.status as VendorInvitePreviewDto["status"],
  };
}

export async function acceptVendorTeamInvite(
  token: string,
  userId: string,
  userEmail: string,
): Promise<{ vendorId: string; storeName: string }> {
  const member = await prisma.vendorMember.findUnique({
    where: { inviteToken: token },
    include: { vendor: { select: { id: true, storeName: true, ownerUserId: true } } },
  });

  if (!member) {
    throw new VendorTeamError("NOT_FOUND", "Invite not found or expired.");
  }
  if (member.status === "REVOKED") {
    throw new VendorTeamError("REVOKED", "This invite was revoked.");
  }
  if (member.status === "ACTIVE" && member.userId === userId) {
    return { vendorId: member.vendor.id, storeName: member.vendor.storeName };
  }
  if (member.status === "ACTIVE") {
    throw new VendorTeamError("ALREADY_ACCEPTED", "This invite was already accepted.");
  }

  if (member.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    throw new VendorTeamError(
      "EMAIL_MISMATCH",
      "Sign in with the email address that received the invite.",
    );
  }

  if (member.vendor.ownerUserId === userId) {
    throw new VendorTeamError("INVALID", "You are already the store owner.");
  }

  const vendorRole = await prisma.role.findUnique({ where: { code: "VENDOR" } });
  if (!vendorRole) {
    throw new VendorTeamError("INVALID", "Vendor role is not configured.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorMember.update({
      where: { id: member.id },
      data: { status: "ACTIVE", userId },
    });

    const hasRole = await tx.userRole.findFirst({
      where: { userId, roleId: vendorRole.id },
    });
    if (!hasRole) {
      await tx.userRole.create({ data: { userId, roleId: vendorRole.id } });
    }
  });

  return { vendorId: member.vendor.id, storeName: member.vendor.storeName };
}
