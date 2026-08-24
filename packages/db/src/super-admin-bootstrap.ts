import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEFAULT_SUPER_ADMIN_EMAIL = "abubaker@fources.net";
const DEFAULT_SUPER_ADMIN_PASSWORD = "Abu@19364";
const DEFAULT_SUPER_ADMIN_NAME = "Platform Super Admin";

/** Idempotent — ensures the platform super admin account exists with SUPER_ADMIN role. */
export async function ensureSuperAdminUser(client: PrismaClient): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL?.trim() || DEFAULT_SUPER_ADMIN_EMAIL).toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || DEFAULT_SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || DEFAULT_SUPER_ADMIN_NAME;

  const superAdminRole = await client.role.findUnique({ where: { code: "SUPER_ADMIN" } });
  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role missing — run role bootstrap first.");
  }

  const existing = await client.user.findUnique({
    where: { email },
    include: {
      userRoles: { where: { roleId: superAdminRole.id }, select: { roleId: true } },
    },
  });

  if (existing) {
    if (existing.userRoles.length === 0) {
      await client.userRole.create({
        data: { userId: existing.id, roleId: superAdminRole.id },
      });
      console.log(`[bootstrap] Attached SUPER_ADMIN role to ${email}.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await client.user.create({
    data: {
      name,
      email,
      passwordHash,
      userRoles: {
        create: { roleId: superAdminRole.id },
      },
    },
  });
  console.log(`[bootstrap] Super admin account ready: ${email}`);
}
