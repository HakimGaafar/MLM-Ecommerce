import { prisma, raceSafeUpsert, type Prisma } from "@mlm/db";
import type { SellerOnboardInput, SellerStoreFieldsInput } from "@mlm/shared";
import { DEFAULT_MARKET_ID, isReservedStoreSlug, slugifyStoreName } from "@mlm/shared";
import bcrypt from "bcryptjs";
import { resolveWalletCurrency } from "../wallet/wallet.service";

export class SellerOnboardError extends Error {
  constructor(
    public readonly code:
      | "EMAIL_IN_USE"
      | "SLUG_TAKEN"
      | "SLUG_RESERVED"
      | "ALREADY_VENDOR"
      | "ROLES_MISSING"
      | "VALIDATION",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SellerOnboardError";
  }
}

export async function isStoreSlugAvailable(
  slug: string,
  excludeVendorId?: string,
  marketId: string = DEFAULT_MARKET_ID,
): Promise<boolean> {
  const normalized = slug.trim().toLowerCase();
  if (isReservedStoreSlug(normalized)) return false;
  const existing = await prisma.vendor.findFirst({
    where: {
      marketId,
      slug: normalized,
      ...(excludeVendorId ? { NOT: { id: excludeVendorId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

export function suggestSlugFromStoreName(storeName: string): string {
  let base = slugifyStoreName(storeName);
  if (base.length < 3) base = `store-${base}`.slice(0, 48);
  if (isReservedStoreSlug(base)) base = `${base}-shop`.slice(0, 48);
  return base;
}

function mapStoreFields(input: SellerStoreFieldsInput) {
  const slug = input.slug.trim().toLowerCase();
  if (isReservedStoreSlug(slug)) {
    throw new SellerOnboardError("SLUG_RESERVED", "This store URL is not available.");
  }
  return {
    storeName: input.storeName.trim(),
    slug,
    countryCode: input.countryCode,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2?.trim() || null,
    state: input.state?.trim() || null,
    city: input.city,
    postalCode: input.postalCode,
    about: input.about?.trim() || null,
    planCode: input.planCode ?? "FREE",
  };
}

async function createVendorForOwner(
  tx: Prisma.TransactionClient,
  ownerUserId: string,
  input: SellerStoreFieldsInput,
  marketId: string,
) {
  const data = mapStoreFields(input);
  const taken = await tx.vendor.findFirst({
    where: { marketId, slug: data.slug },
    select: { id: true },
  });
  if (taken) {
    throw new SellerOnboardError("SLUG_TAKEN", "This store URL is already in use.");
  }

  const existingVendor = await tx.vendor.findFirst({
    where: { ownerUserId, marketId },
    select: { id: true },
  });
  if (existingVendor) {
    throw new SellerOnboardError("ALREADY_VENDOR", "You already have a store in this marketplace.");
  }

  return tx.vendor.create({
    data: {
      marketId,
      ownerUserId,
      ...data,
    },
  });
}

async function ensureVendorRole(tx: Prisma.TransactionClient, userId: string) {
  const vendorRole = await tx.role.findUnique({ where: { code: "VENDOR" } });
  if (!vendorRole) throw new SellerOnboardError("ROLES_MISSING", "VENDOR role missing. Run database seed.");

  const userRoleWhere = { userId_roleId: { userId, roleId: vendorRole.id } };
  await raceSafeUpsert({
    upsert: () =>
      tx.userRole.upsert({
        where: userRoleWhere,
        create: { userId, roleId: vendorRole.id },
        update: {},
      }),
    findUnique: () => tx.userRole.findUnique({ where: userRoleWhere }),
  });
}

function newReferralCode(email: string, userId: string) {
  const base = (email.split("@")[0] ?? "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `${base}${userId.slice(-4)}`;
}

export async function onboardNewSeller(
  input: SellerOnboardInput,
  marketId: string,
): Promise<{
  userId: string;
  email: string;
  vendorId: string;
  slug: string;
}> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new SellerOnboardError("EMAIL_IN_USE", "Email already in use.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name.trim(), email, passwordHash },
    });

    const customerRole = await tx.role.findUnique({ where: { code: "CUSTOMER" } });
    const vendorRole = await tx.role.findUnique({ where: { code: "VENDOR" } });
    const affiliateRole = await tx.role.findUnique({ where: { code: "AFFILIATE" } });
    if (!customerRole || !vendorRole || !affiliateRole) {
      throw new SellerOnboardError("ROLES_MISSING", "Roles missing. Run database seed.");
    }

    await tx.userRole.createMany({
      data: [
        { userId: user.id, roleId: customerRole.id },
        { userId: user.id, roleId: vendorRole.id },
        { userId: user.id, roleId: affiliateRole.id },
      ],
      skipDuplicates: true,
    });

    const walletCurrency = await resolveWalletCurrency(marketId);
    await tx.wallet.create({ data: { userId: user.id, marketId, currency: walletCurrency } });

    const code = newReferralCode(email, user.id);
    await tx.affiliateProfile.create({
      data: { userId: user.id, referralCode: code },
    });

    const vendor = await createVendorForOwner(tx, user.id, input, marketId);

    return { user, vendor };
  });

  return {
    userId: result.user.id,
    email: result.user.email,
    vendorId: result.vendor.id,
    slug: result.vendor.slug,
  };
}

/** Logged-in user (typically customer) creates their first store and gains VENDOR role. */
export async function createStoreForExistingUser(
  userId: string,
  input: SellerStoreFieldsInput,
  marketId: string,
): Promise<{ vendorId: string; slug: string }> {
  const result = await prisma.$transaction(async (tx) => {
    await ensureVendorRole(tx, userId);
    const vendor = await createVendorForOwner(tx, userId, input, marketId);
    return vendor;
  });

  return { vendorId: result.id, slug: result.slug };
}
