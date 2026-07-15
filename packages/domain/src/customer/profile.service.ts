import { Prisma, prisma, raceSafeUpsert } from "@mlm/db";
import type { CustomerProfileDto, CustomerProfileUpdateInput } from "@mlm/shared";

function asOptional(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function normalizeOptional(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toDto(data: {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  countryCode: string;
  city: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  shipSameAsBilling: boolean;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  shippingCountryCode: string | null;
  preferredLanguage: "en" | "ar";
  createdAt: Date;
  updatedAt: Date;
}): CustomerProfileDto {
  return {
    userId: data.userId,
    name: data.name,
    email: data.email,
    phone: asOptional(data.phone),
    countryCode: data.countryCode,
    city: asOptional(data.city),
    addressLine1: asOptional(data.addressLine1),
    addressLine2: asOptional(data.addressLine2),
    postalCode: asOptional(data.postalCode),
    shipSameAsBilling: data.shipSameAsBilling,
    shippingAddressLine1: asOptional(data.shippingAddressLine1),
    shippingAddressLine2: asOptional(data.shippingAddressLine2),
    shippingCity: asOptional(data.shippingCity),
    shippingPostalCode: asOptional(data.shippingPostalCode),
    shippingCountryCode: asOptional(data.shippingCountryCode),
    preferredLanguage: data.preferredLanguage,
    createdAt: data.createdAt.toISOString(),
    updatedAt: data.updatedAt.toISOString(),
  };
}

const profileSelect = {
  phone: true,
  countryCode: true,
  city: true,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  shipSameAsBilling: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingCountryCode: true,
  preferredLanguage: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getCustomerProfile(userId: string): Promise<CustomerProfileDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      customerProfile: { select: profileSelect },
    },
  });

  if (!user) return null;

  if (!user.customerProfile) {
    const created = await prisma.customerProfile.create({
      data: {
        userId,
        shipSameAsBilling: true,
      },
      select: profileSelect,
    });

    return toDto({
      userId,
      name: user.name,
      email: user.email,
      phone: created.phone,
      countryCode: created.countryCode,
      city: created.city,
      addressLine1: created.addressLine1,
      addressLine2: created.addressLine2,
      postalCode: created.postalCode,
      shipSameAsBilling: created.shipSameAsBilling,
      shippingAddressLine1: created.shippingAddressLine1,
      shippingAddressLine2: created.shippingAddressLine2,
      shippingCity: created.shippingCity,
      shippingPostalCode: created.shippingPostalCode,
      shippingCountryCode: created.shippingCountryCode,
      preferredLanguage: created.preferredLanguage as "en" | "ar",
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  }

  const cp = user.customerProfile;
  return toDto({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: cp.phone,
    countryCode: cp.countryCode,
    city: cp.city,
    addressLine1: cp.addressLine1,
    addressLine2: cp.addressLine2,
    postalCode: cp.postalCode,
    shipSameAsBilling: cp.shipSameAsBilling,
    shippingAddressLine1: cp.shippingAddressLine1,
    shippingAddressLine2: cp.shippingAddressLine2,
    shippingCity: cp.shippingCity,
    shippingPostalCode: cp.shippingPostalCode,
    shippingCountryCode: cp.shippingCountryCode,
    preferredLanguage: cp.preferredLanguage as "en" | "ar",
    createdAt: cp.createdAt,
    updatedAt: cp.updatedAt,
  });
}

export async function updateCustomerProfile(
  userId: string,
  input: CustomerProfileUpdateInput,
): Promise<CustomerProfileDto | null> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!existing) return null;

  const userName = normalizeOptional(input.name);
  const userUpdateData = userName ? { name: userName } : undefined;

  const currentProfile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { shipSameAsBilling: true },
  });
  const nextShipSame = input.shipSameAsBilling ?? currentProfile?.shipSameAsBilling ?? true;
  const clearShipping = input.shipSameAsBilling === true;

  const profilePatch: Prisma.CustomerProfileUpdateInput = {};
  if (input.phone !== undefined) profilePatch.phone = normalizeOptional(input.phone) ?? null;
  if (input.countryCode !== undefined) profilePatch.countryCode = input.countryCode.toUpperCase();
  if (input.city !== undefined) profilePatch.city = normalizeOptional(input.city) ?? null;
  if (input.addressLine1 !== undefined) profilePatch.addressLine1 = normalizeOptional(input.addressLine1) ?? null;
  if (input.addressLine2 !== undefined) profilePatch.addressLine2 = normalizeOptional(input.addressLine2) ?? null;
  if (input.postalCode !== undefined) profilePatch.postalCode = normalizeOptional(input.postalCode) ?? null;
  if (input.shipSameAsBilling !== undefined) profilePatch.shipSameAsBilling = input.shipSameAsBilling;
  if (clearShipping) {
    profilePatch.shippingAddressLine1 = null;
    profilePatch.shippingAddressLine2 = null;
    profilePatch.shippingCity = null;
    profilePatch.shippingPostalCode = null;
    profilePatch.shippingCountryCode = null;
  } else {
    if (input.shippingAddressLine1 !== undefined) {
      profilePatch.shippingAddressLine1 = normalizeOptional(input.shippingAddressLine1) ?? null;
    }
    if (input.shippingAddressLine2 !== undefined) {
      profilePatch.shippingAddressLine2 = normalizeOptional(input.shippingAddressLine2) ?? null;
    }
    if (input.shippingCity !== undefined) profilePatch.shippingCity = normalizeOptional(input.shippingCity) ?? null;
    if (input.shippingPostalCode !== undefined) {
      profilePatch.shippingPostalCode = normalizeOptional(input.shippingPostalCode) ?? null;
    }
    if (input.shippingCountryCode !== undefined) {
      profilePatch.shippingCountryCode = normalizeOptional(input.shippingCountryCode) ?? null;
    }
  }
  if (input.preferredLanguage !== undefined) profilePatch.preferredLanguage = input.preferredLanguage;

  await prisma.$transaction(async (tx) => {
    if (userUpdateData) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    await raceSafeUpsert({
      upsert: () =>
        tx.customerProfile.upsert({
          where: { userId },
          update: profilePatch,
          create: {
            userId,
            phone: normalizeOptional(input.phone) ?? null,
            countryCode: input.countryCode?.toUpperCase() ?? "SA",
            city: normalizeOptional(input.city) ?? null,
            addressLine1: normalizeOptional(input.addressLine1) ?? null,
            addressLine2: normalizeOptional(input.addressLine2) ?? null,
            postalCode: normalizeOptional(input.postalCode) ?? null,
            shipSameAsBilling: nextShipSame,
            shippingAddressLine1: clearShipping ? null : normalizeOptional(input.shippingAddressLine1) ?? null,
            shippingAddressLine2: clearShipping ? null : normalizeOptional(input.shippingAddressLine2) ?? null,
            shippingCity: clearShipping ? null : normalizeOptional(input.shippingCity) ?? null,
            shippingPostalCode: clearShipping ? null : normalizeOptional(input.shippingPostalCode) ?? null,
            shippingCountryCode: clearShipping ? null : normalizeOptional(input.shippingCountryCode) ?? null,
            preferredLanguage: input.preferredLanguage ?? "en",
          },
        }),
      findUnique: () => tx.customerProfile.findUnique({ where: { userId } }),
    });
  });

  return getCustomerProfile(userId);
}
