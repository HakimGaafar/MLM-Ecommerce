import { createHash, randomBytes } from "node:crypto";
import type { PasswordResetAuditAction, Prisma } from "@mlm/db";
import { prisma } from "@mlm/db";
import {
  buildPaginatedResult,
  normalizePagination,
  type PaginatedResult,
} from "@mlm/shared";
import bcrypt from "bcryptjs";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes
const BCRYPT_ROUNDS = 10;

export class PasswordResetError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TOKEN"
      | "WEAK_PASSWORD"
      | "SAME_PASSWORD"
      | "USER_INACTIVE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PasswordResetError";
  }
}

function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generatePasswordResetRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function writePasswordResetAudit(input: {
  action: PasswordResetAuditAction;
  email: string;
  userId?: string | null;
  ipAddress?: string | null;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.passwordResetAuditLog.create({
    data: {
      action: input.action,
      email: input.email,
      userId: input.userId ?? null,
      ipAddress: input.ipAddress ?? null,
      meta: input.meta ?? undefined,
    },
  });
}

export type PasswordResetRequestResult = {
  /** Present only when an active user exists and a token was created. */
  rawToken: string | null;
  userId: string | null;
  userName: string | null;
  email: string;
};

/**
 * Creates a one-time reset token for an active user.
 * Always safe to call — returns null token when no active account matches.
 * Invalidates any previous unused tokens for that user.
 */
export async function createPasswordResetRequest(input: {
  email: string;
  ipAddress?: string | null;
}): Promise<PasswordResetRequestResult> {
  const email = input.email;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    await writePasswordResetAudit({
      action: "RESET_REQUESTED",
      email,
      userId: null,
      ipAddress: input.ipAddress,
      meta: { userFound: false },
    });
    return { rawToken: null, userId: null, userName: null, email };
  }

  const rawToken = generatePasswordResetRawToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  await writePasswordResetAudit({
    action: "RESET_REQUESTED",
    email,
    userId: user.id,
    ipAddress: input.ipAddress,
    meta: { userFound: true },
  });

  return {
    rawToken,
    userId: user.id,
    userName: user.name,
    email,
  };
}

export async function validatePasswordResetToken(rawToken: string): Promise<boolean> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 128) return false;
  const tokenHash = hashResetToken(rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { usedAt: true, expiresAt: true, user: { select: { status: true } } },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return false;
  return row.user.status === "ACTIVE";
}

/**
 * Consumes a one-time token and sets a new password hash.
 * Returns the user id so callers can revoke sessions and send confirmation mail.
 */
export async function resetPasswordWithToken(input: {
  rawToken: string;
  newPassword: string;
  ipAddress?: string | null;
}): Promise<{ userId: string; email: string; name: string }> {
  if (input.newPassword.length < 10 || input.newPassword.length > 128) {
    throw new PasswordResetError("WEAK_PASSWORD");
  }

  const tokenHash = hashResetToken(input.rawToken);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true, status: true, passwordHash: true } } },
  });

  if (
    !row ||
    row.usedAt ||
    row.expiresAt.getTime() <= Date.now() ||
    row.user.status !== "ACTIVE"
  ) {
    throw new PasswordResetError("INVALID_TOKEN");
  }

  const same = await bcrypt.compare(input.newPassword, row.user.passwordHash);
  if (same) {
    throw new PasswordResetError("SAME_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const marked = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (marked.count !== 1) {
      throw new PasswordResetError("INVALID_TOKEN");
    }
    await tx.user.update({
      where: { id: row.user.id },
      data: { passwordHash },
    });
    // Invalidate any other outstanding tokens for this user.
    await tx.passwordResetToken.deleteMany({
      where: { userId: row.user.id, usedAt: null },
    });
  });

  await writePasswordResetAudit({
    action: "RESET_COMPLETED",
    email: row.user.email,
    userId: row.user.id,
    ipAddress: input.ipAddress,
  });

  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
  };
}

export type PasswordResetAuditRowDto = {
  id: string;
  action: PasswordResetAuditAction;
  email: string;
  userId: string | null;
  userName: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export async function listPasswordResetAudits(input: {
  page?: number;
  pageSize?: number;
  action?: PasswordResetAuditAction;
}): Promise<PaginatedResult<PasswordResetAuditRowDto>> {
  const { page, pageSize, skip, take } = normalizePagination(input);
  const where: Prisma.PasswordResetAuditLogWhereInput = {
    ...(input.action ? { action: input.action } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.passwordResetAuditLog.count({ where }),
    prisma.passwordResetAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return buildPaginatedResult(
    rows.map((row) => ({
      id: row.id,
      action: row.action,
      email: row.email,
      userId: row.userId,
      userName: row.user?.name ?? null,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  );
}
