import type {
  CustomerShippingAddressCreateInput,
  CustomerShippingAddressDto,
  CustomerShippingAddressUpdateInput,
  PaginatedResult,
} from "@mlm/shared";
import { buildPaginatedResult, normalizePagination } from "@mlm/shared";
import { Prisma, prisma } from "@mlm/db";
import { getCustomerProfile } from "./profile.service";
import { assertProfileReadyForCheckout, buildShippingSnapshotFromProfile } from "./shipping-profile";

type AddressSignatureFields = {
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string | null;
};

function addressSignature(row: AddressSignatureFields): string {
  return [
    row.recipientName.trim().toLowerCase(),
    row.phone.trim(),
    row.countryCode.trim().toUpperCase(),
    row.city.trim().toLowerCase(),
    row.postalCode.trim(),
    row.addressLine1.trim().toLowerCase(),
    (row.addressLine2?.trim() ?? "").toLowerCase(),
  ].join("\0");
}

/** Removes exact duplicate rows (e.g. from concurrent auto-seed). Keeps default, else oldest. */
async function dedupeIdenticalShippingAddresses(userId: string): Promise<void> {
  const rows = await prisma.customerShippingAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (rows.length < 2) return;

  const deleteIds: string[] = [];
  const bySig = new Map<string, typeof rows>();

  for (const row of rows) {
    const sig = addressSignature(row);
    const group = bySig.get(sig) ?? [];
    group.push(row);
    bySig.set(sig, group);
  }

  for (const group of bySig.values()) {
    if (group.length < 2) continue;
    const keeper = group.find((r) => r.isDefault) ?? group[0]!;
    for (const row of group) {
      if (row.id !== keeper.id) deleteIds.push(row.id);
    }
  }

  if (deleteIds.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.customerShippingAddress.deleteMany({ where: { id: { in: deleteIds } } });
    const stillHasDefault = await tx.customerShippingAddress.findFirst({
      where: { userId, isDefault: true },
      select: { id: true },
    });
    if (stillHasDefault) return;
    const first = await tx.customerShippingAddress.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (first) {
      await tx.customerShippingAddress.update({
        where: { id: first.id },
        data: { isDefault: true },
      });
    }
  });
}

function mapRow(row: {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string;
  phone: string;
  countryCode: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerShippingAddressDto {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label ?? undefined,
    recipientName: row.recipientName,
    phone: row.phone,
    countryCode: row.countryCode,
    city: row.city,
    postalCode: row.postalCode,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2 ?? undefined,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * When the customer has no saved addresses yet but the profile is checkout-ready,
 * create one default row from the billing/shipping profile snapshot (migration-friendly).
 */
export async function ensureDefaultShippingAddressFromProfile(userId: string): Promise<void> {
  const profile = await getCustomerProfile(userId);
  if (!profile) return;

  try {
    assertProfileReadyForCheckout(profile);
  } catch {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!user) return;

  const snap = buildShippingSnapshotFromProfile(profile, user.name);
  const seedRow: AddressSignatureFields = {
    recipientName: snap.shippingRecipientName,
    phone: snap.shippingPhone,
    countryCode: snap.shippingCountryCode,
    city: snap.shippingCity,
    postalCode: snap.shippingPostalCode,
    addressLine1: snap.shippingAddressLine1,
    addressLine2: snap.shippingAddressLine2,
  };
  const sig = addressSignature(seedRow);

  try {
    await prisma.$transaction(
      async (tx) => {
        const count = await tx.customerShippingAddress.count({ where: { userId } });
        if (count > 0) return;

        const rows = await tx.customerShippingAddress.findMany({ where: { userId } });
        if (rows.some((row) => addressSignature(row) === sig)) return;

        await tx.customerShippingAddress.create({
          data: {
            userId,
            label: null,
            recipientName: seedRow.recipientName,
            phone: seedRow.phone,
            countryCode: seedRow.countryCode,
            city: seedRow.city,
            postalCode: seedRow.postalCode,
            addressLine1: seedRow.addressLine1,
            addressLine2: seedRow.addressLine2,
            isDefault: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return;
    }
    throw error;
  }
}

/** All addresses — used at checkout (radio list). */
export async function listAllCustomerShippingAddressesForCheckout(
  userId: string,
): Promise<CustomerShippingAddressDto[]> {
  await ensureDefaultShippingAddressFromProfile(userId);
  await dedupeIdenticalShippingAddresses(userId);
  const rows = await prisma.customerShippingAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map(mapRow);
}

export async function listCustomerShippingAddresses(
  userId: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResult<CustomerShippingAddressDto>> {
  await ensureDefaultShippingAddressFromProfile(userId);
  await dedupeIdenticalShippingAddresses(userId);
  const { page, pageSize, skip, take } = normalizePagination(params);
  const where = { userId };
  const [rows, total] = await prisma.$transaction([
    prisma.customerShippingAddress.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      skip,
      take,
    }),
    prisma.customerShippingAddress.count({ where }),
  ]);
  return buildPaginatedResult(rows.map(mapRow), total, page, pageSize);
}

export async function getDefaultShippingAddressId(userId: string): Promise<string | null> {
  await ensureDefaultShippingAddressFromProfile(userId);
  await dedupeIdenticalShippingAddresses(userId);
  const row = await prisma.customerShippingAddress.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  });
  if (row) return row.id;
  const first = await prisma.customerShippingAddress.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export async function getCustomerShippingAddressForBuyer(
  userId: string,
  addressId: string,
): Promise<CustomerShippingAddressDto | null> {
  const row = await prisma.customerShippingAddress.findFirst({
    where: { id: addressId, userId },
  });
  return row ? mapRow(row) : null;
}

export function buildOrderShippingFromSavedAddress(addr: CustomerShippingAddressDto) {
  return {
    shippingRecipientName: addr.recipientName.trim(),
    shippingPhone: addr.phone.trim(),
    shippingCountryCode: addr.countryCode.trim(),
    shippingCity: addr.city.trim(),
    shippingPostalCode: addr.postalCode.trim(),
    shippingAddressLine1: addr.addressLine1.trim(),
    shippingAddressLine2: addr.addressLine2?.trim() || null,
  };
}

export async function createCustomerShippingAddress(
  userId: string,
  input: CustomerShippingAddressCreateInput,
): Promise<CustomerShippingAddressDto> {
  const count = await prisma.customerShippingAddress.count({ where: { userId } });
  const makeDefault = input.isDefault === true || count === 0;

  return await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.customerShippingAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    const row = await tx.customerShippingAddress.create({
      data: {
        userId,
        label: input.label ?? null,
        recipientName: input.recipientName.trim(),
        phone: input.phone.trim(),
        countryCode: input.countryCode.trim(),
        city: input.city.trim(),
        postalCode: input.postalCode.trim(),
        addressLine1: input.addressLine1.trim(),
        addressLine2: input.addressLine2?.trim() ?? null,
        isDefault: makeDefault,
      },
    });
    return mapRow(row);
  });
}

export async function updateCustomerShippingAddress(
  userId: string,
  addressId: string,
  input: CustomerShippingAddressUpdateInput,
): Promise<CustomerShippingAddressDto | null> {
  const existing = await prisma.customerShippingAddress.findFirst({
    where: { id: addressId, userId },
  });
  if (!existing) return null;

  const row = await prisma.customerShippingAddress.update({
    where: { id: addressId },
    data: {
      ...(input.label !== undefined ? { label: input.label ?? null } : {}),
      ...(input.recipientName !== undefined ? { recipientName: input.recipientName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode.trim() } : {}),
      ...(input.city !== undefined ? { city: input.city.trim() } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode.trim() } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1.trim() } : {}),
      ...(input.addressLine2 !== undefined
        ? {
            addressLine2:
              input.addressLine2 === null || input.addressLine2 === undefined
                ? null
                : input.addressLine2.trim() || null,
          }
        : {}),
    },
  });
  return mapRow(row);
}

export async function deleteCustomerShippingAddress(userId: string, addressId: string): Promise<boolean> {
  const existing = await prisma.customerShippingAddress.findFirst({
    where: { id: addressId, userId },
    select: { id: true, isDefault: true },
  });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.customerShippingAddress.delete({
      where: { id: addressId },
    });
    if (existing.isDefault) {
      const next = await tx.customerShippingAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await tx.customerShippingAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });
  return true;
}

export async function setDefaultCustomerShippingAddress(userId: string, addressId: string): Promise<boolean> {
  const existing = await prisma.customerShippingAddress.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.customerShippingAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    await tx.customerShippingAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });
  return true;
}
